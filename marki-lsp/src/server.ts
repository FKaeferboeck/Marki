import { createConnection, TextDocuments, ProposedFeatures, InitializeParams,
	DidChangeConfigurationNotification, TextDocumentPositionParams, TextDocumentSyncKind,
	InitializeResult, DocumentDiagnosticReportKind, type DocumentDiagnosticReport, SemanticTokensBuilder,
	Hover, TextDocumentContentChangeEvent, SemanticTokensParams, SemanticTokensRequest, TextDocumentsConfiguration,
	_,
	_Connection,
} from 'vscode-languageserver/node.js';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { LineStructure, IncrementalChange, linify, MarkiDocument } from "marki";

import EventEmitter = require('events');
import { getMarkiInstance, Marki_LSP_plugin, MarkiParse } from './marki-processing.js';
import { AnyBlock } from 'marki';
import { blockDistributionInfo, findBlock } from './util.js';
import { provideTooltip } from './provide-tooltip.js';
import { InlineCompletionFeatureShape } from 'vscode-languageserver/lib/common/inlineCompletion.proposed.js';

export { getMarkiParser } from './marki-processing.js';

const eventEmitter = new EventEmitter();

const waitForDocument = (docname: DocumentUri) => new Promise(resolve => void(eventEmitter.once('loadDocument:' + docname, resolve)));


interface MyTextDocument {
	uri:           DocumentUri;
	doc:           TextDocument;
	lineStructure: LineStructure;
	pending:       Promise<MarkiDocument> | undefined;
	blocks:        AnyBlock[];
	changeBuffer:  IncrementalChange[];
	builder:       SemanticTokensBuilder;
}

const MyTextDocument: TextDocumentsConfiguration<MyTextDocument> = {
	create: function(uri: DocumentUri, languageId: string, version: number, content: string): MyTextDocument {
		//console.log(`Create document [${uri}]`);
		const pending = MarkiParse(content).then(doc => {
			console.log(blockDistributionInfo(doc.blocks));
			return doc;
		});

		const D: MyTextDocument = {
			uri:           uri,
			doc:           TextDocument.create(uri, languageId, version, content),
			lineStructure: { logical_lines: linify(content, true) },
			pending,
			blocks:        [],
			changeBuffer:  [],
			builder:       new SemanticTokensBuilder()
		};
		return D;
	},
	update: function(document: MyTextDocument, changes: TextDocumentContentChangeEvent[], version: number): MyTextDocument {
		//console.log('Intercepted update!', changes);
		//document.changeBuffer
		TextDocument.update(document.doc, changes, version);

		for(const C of changes) {
			if(TextDocumentContentChangeEvent.isIncremental(C))
				document.changeBuffer.push(C);
			else
				console.log('onDidChangeTextDocument full!');
		}

		return document;
	}
};


// Create a simple text document manager.
const documents = new TextDocuments(MyTextDocument);


let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// The example settings
interface ExampleSettings { maxNumberOfProblems: number; }

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<ExampleSettings>>();

// Only keep settings for open documents
documents.onDidClose(e => { documentSettings.delete(e.document.uri); });



export function startMarkiLSP(pluginModuleFiles: string[]): _Connection<_, _, _, _, _, _, InlineCompletionFeatureShape, _> {
	// Create a connection for the server, using Node's IPC as a transport.
	const sdsmd_language_server = createConnection(ProposedFeatures.all);

	sdsmd_language_server.onInitialize((params: InitializeParams) => {
		const caps = params.capabilities;
		const inst = getMarkiInstance();
		inst.pluginFiles.push(... pluginModuleFiles);
		const MDP = getMarkiInstance().MDP;
		pluginModuleFiles.forEach(file => {
			const F = require(file);
			if(!F)
				throw new Error(`Cannot read plugin source "${file}"`);
			const plugin = F as Marki_LSP_plugin;
			plugin.registerMarkiExtension?.(MDP);
			plugin.registerTooltipProviders?.(inst.tooltip);
		});

		// Does the client support the `workspace/configuration` request?
		// If not, we fall back using global settings.
		hasConfigurationCapability                = !!(caps.workspace && !!caps.workspace.configuration);
		hasWorkspaceFolderCapability              = !!(caps.workspace && !!caps.workspace.workspaceFolders);
		hasDiagnosticRelatedInformationCapability = !!(caps.textDocument &&
													caps.textDocument.publishDiagnostics &&
													caps.textDocument.publishDiagnostics.relatedInformation);

		const result: InitializeResult = {
			capabilities: {
				textDocumentSync:   TextDocumentSyncKind.Incremental,
				//completionProvider: { resolveProvider: true },
				diagnosticProvider: { interFileDependencies: false,  workspaceDiagnostics: false },
				hoverProvider: true
			},
			semanticTokensProvider: {
				legend: {
					tokenTypes: ["function", "namespace"], // register legend like the same thing in VS Code example
					tokenModifiers: [],
				},
			}
		};

		if (hasWorkspaceFolderCapability)
			result.capabilities.workspace = { workspaceFolders: { supported: true } };
		console.log('Initialie!')
		return result;
	});

	sdsmd_language_server.onInitialized(() => {
		if (hasConfigurationCapability) {
			// Register for all configuration changes.
			sdsmd_language_server.client.register(DidChangeConfigurationNotification.type, undefined);
		}
		if (hasWorkspaceFolderCapability) {
			sdsmd_language_server.workspace.onDidChangeWorkspaceFolders(_event => {
				sdsmd_language_server.console.log('Workspace folder change event received.');
			});
		}
	});

	sdsmd_language_server.onDidChangeConfiguration(change => {
		if (hasConfigurationCapability)
			documentSettings.clear(); // Reset all cached document settings
		else
			globalSettings = (
				(change.settings.languageServerExample || defaultSettings)
			);
		// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
		// We could optimize things here and re-fetch the setting first can compare it
		// to the existing setting, but this is out of scope for this example.
		sdsmd_language_server.languages.diagnostics.refresh();
	});

	function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
		if (!hasConfigurationCapability) {
			return Promise.resolve(globalSettings);
		}
		let result = documentSettings.get(resource);
		if (!result) {
			result = sdsmd_language_server.workspace.getConfiguration({
				scopeUri: resource,
				section: 'languageServerExample'
			});
			documentSettings.set(resource, result);
		}
		return result;
	}

	sdsmd_language_server.onRequest(SemanticTokensRequest.method, async (params: SemanticTokensParams) => {
		let document = documents.get(params.textDocument.uri);
		if(!document) {
			await waitForDocument(params.textDocument.uri);
			document = documents.get(params.textDocument.uri);
			if(!document)
				return (new SemanticTokensBuilder()).build();
		}
		console.log('Request full tokens, we have ', params.textDocument.uri/*, document.lineStructure.all.length*/);
		const builder = document.builder;
		/*for(const P of document.lineStructure.all) {
			if(P.type === "XML_Comment")
				builder.push(P.line, P.character, P.content.length, 17, 0);
		}*/
		builder.push(0, 5, 150, 17, 0);
		builder.push(0, 10, 10, 16, 0);
		return builder.build();
	});

	sdsmd_language_server.languages.diagnostics.on(async (params) => {
		//console.log('Diagnostics event on ' + params.textDocument.uri);
		//const document = documents.get(params.textDocument.uri);
		//console.log(document);
		/*if (document !== undefined) {
			return {
				kind: DocumentDiagnosticReportKind.Full,
				items: await validateTextDocument(connection, document)
			} satisfies DocumentDiagnosticReport;
		} else */{
			// We don't know the document. We can either try to read it from disk
			// or we don't report problems for it.
			return {
				kind: DocumentDiagnosticReportKind.Full,
				items: []
			} satisfies DocumentDiagnosticReport;
		}
	});
	
	sdsmd_language_server.onHover(async (params: TextDocumentPositionParams): Promise<Hover | null> => {
		console.log(`Hover on "${params.textDocument.uri}" ${params.position.line}/${params.position.character}`);
		const doc = documents.get(params.textDocument.uri);
		if(!doc)    return null;
	
		if(doc.pending)
			await doc.pending.then(Bs => {
				doc.blocks = Bs.blocks;
				doc.pending = undefined;
			});
		const B = findBlock(doc.blocks, params.position.line);
		if(!B || B.type === "emptySpace")    return null;
		const P = { ... params.position };
		P.line -= B.lineIdx;
		const contents = provideTooltip(B, P);
		if(!contents)
			return null;
		if(typeof contents === "string")
			return { contents };
		return contents.then(contents => ({ contents }));
	});
	
	/*connection.onDidChangeWatchedFiles(_change => {
		console.log('onDidChangeWatchedFiles');
	});*/
	
	// Make the text document manager listen on the connection for open, change and close text document events
	documents.listen(sdsmd_language_server);
	
	// Listen on the connection
	//sdsmd_language_server.listen();
	return sdsmd_language_server;
} // function startMarkiLSP()


/*connection.onRequest(SemanticTokensDeltaRequest.method, (params: SemanticTokensDeltaParams) => {
	const document = documents.get(params.textDocument.uri);
	if(!document)
		return [];
	
	condenseChanges(document);
	const LS = document.lineStructure;
	for(const D of document.changeBuffer)
		linify_update(LS, D);
	
	const B = document.builder;
	B.previousResult(B.id);
	if(!B.canBuildEdits())
		return { edits: [] };
	for(const P of LS.all) {
		if(P.type === "XML_Comment")
			B.push(P.line, P.character, P.content.length, 17, 0);
	}

	document.changeBuffer = []; // clear change buffer
	return B.buildEdits() as SemanticTokensDelta;
});*/


documents.onDidOpen(evt => void(eventEmitter.emit('loadDocument:' + evt.document.uri)));
