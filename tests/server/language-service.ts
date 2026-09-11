import ts from 'typescript'
import pluginFactory from '../../packages/lupos-server/src/index'

const LuposTypes = `
declare module 'lupos.html' {
	export function html(strings: TemplateStringsArray, ...values: unknown[]): unknown
	export function css(strings: TemplateStringsArray, ...values: unknown[]): unknown
	export class EventFirer<Events = {}> {}
	export class Component<Events = {}> extends EventFirer<Events> {
		el: HTMLElement
		on<K extends keyof Events>(name: K, handler: (event: Events[K]) => void, context?: unknown): void
	}
	export interface Binding {}
	export type EventHandlerMixed = (event: Event) => void
	export class on {
		constructor(element: Element, context: unknown)
		update(name: string, handler: EventHandlerMixed | null): void
	}
}
`

export interface TestLanguageService {
	fileName: string
	host: ts.LanguageServiceHost
	service: ts.LanguageService
	update(text: string): void
	read(fileName?: string): string
}

export function createTestLanguageService(text: string, extraFiles: Record<string, string> = {}): TestLanguageService {
	let fileName = 'C:/project/main.ts'
	let typesFileName = 'C:/project/lupos-html.d.ts'
	let files = new Map([
		[fileName, {text, version: 0}],
		[typesFileName, {text: LuposTypes, version: 0}],
		...Object.entries(extraFiles).map(([name, fileText]) => [name, {text: fileText, version: 0}] as const),
	])
	let options: ts.CompilerOptions = {
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.Node10,
		strict: true,
		target: ts.ScriptTarget.ES2022,
	}
	let host: ts.LanguageServiceHost = {
		getCompilationSettings: () => options,
		getCurrentDirectory: () => 'C:/project',
		getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
		getScriptFileNames: () => [...files.keys()],
		getScriptSnapshot: name => {
			let file = files.get(name)
			if (file) return ts.ScriptSnapshot.fromString(file.text)
			let diskText = ts.sys.readFile(name)
			return diskText === undefined ? undefined : ts.ScriptSnapshot.fromString(diskText)
		},
		getScriptVersion: name => String(files.get(name)?.version ?? 0),
		fileExists: name => files.has(name) || ts.sys.fileExists(name),
		readFile: name => files.get(name)?.text ?? ts.sys.readFile(name),
		readDirectory: ts.sys.readDirectory,
	}
	let rawService = ts.createLanguageService(host)
	let logger = {info() {}} as ts.server.Logger
	let info = {
		languageService: rawService,
		languageServiceHost: host,
		serverHost: ts.sys,
		project: {projectService: {logger}},
	} as ts.server.PluginCreateInfo
	let service = pluginFactory({typescript: ts}).create(info)

	return {
		fileName,
		host,
		service,
		update(newText) {
			let file = files.get(fileName)!
			file.text = newText
			file.version++
		},
		read(name = fileName) {
			return files.get(name)!.text
		},
	}
}

export function diagnosticMessages(diagnostics: readonly ts.Diagnostic[]) {
	return diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}
