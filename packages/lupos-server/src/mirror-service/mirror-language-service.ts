import type TS from 'typescript'
import {ProjectContext, ts} from '../core'
import {
	buildTypeScriptMirror,
	mapMirrorSpanToOriginal,
	mapOriginalPositionToMirror,
	MirrorCapability,
	MirrorDocument,
} from '../lupos-ts-module'


/** Cached mirror source for one real SourceFile identity. */
interface MirrorSource {
	/** Most recent real SourceFile represented by this cache entry. */
	sourceFile: TS.SourceFile

	/** Original text used to construct the mirror. */
	sourceText: string

	/** Generated mirror document, or null when this file needs no mirror. */
	document: MirrorDocument | null

	/** Snapshot supplied to the mirror language service. */
	snapshot: TS.IScriptSnapshot
}


/** Provides a project-wide TypeScript language service over Lupos mirror documents. */
export class MirrorLanguageService {

	/** Mirror sources reused across equivalent TypeScript Program revisions. */
	private readonly sourcesByFile: Map<string, MirrorSource> = new Map()

	/** Real Program revision represented by the retained mirror sources. */
	private sourcesProgram: TS.Program | null = null

	/** Mirror host delegating project behavior to tsserver. */
	private readonly host: TS.LanguageServiceHost

	/** TypeScript service operating on mirror snapshots. */
	private readonly service: TS.LanguageService

	/** Real project context supplying current programs and snapshots. */
	private readonly context: ProjectContext

	constructor(context: ProjectContext) {
		this.context = context
		this.host = this.createHost(context.languageServiceHost)
		this.service = ts.createLanguageService(this.host)
	}

	/** Get the mirror TypeScript language service. */
	getTypeScriptService(): TS.LanguageService {
		return this.service
	}

	/** Map a real position to a capability-compatible mirror position. */
	mapPosition(fileName: string, position: number, capability: MirrorCapability): number | null {
		let document = this.getDocument(fileName)

		if (document) {
			return mapOriginalPositionToMirror(document, position, capability)
		}

		return this.getRealSourceFile(fileName) ? position : null
	}

	/** Map a mirror span back through the document that owns it. */
	mapSpan(fileName: string, span: TS.TextSpan, capability: MirrorCapability): TS.TextSpan | null {
		let document = this.getDocument(fileName)
		return document
			? mapMirrorSpanToOriginal(document, span, capability)
			: span
	}

	/** Whether a source file has a generated mirror. */
	hasDocument(fileName: string): boolean {
		return !!this.getDocument(fileName)
	}

	/** Get a SourceFile from the current real TypeScript program. */
	getRealSourceFile(fileName: string): TS.SourceFile | undefined {
		return this.context.program.getSourceFile(fileName)
	}

	/** Dispose the secondary TypeScript language service. */
	dispose() {
		this.service.dispose()
		this.sourcesByFile.clear()
		this.sourcesProgram = null
	}

	/** Create an overlay host while retaining tsserver project behavior. */
	private createHost(originalHost: TS.LanguageServiceHost): TS.LanguageServiceHost {
		let host = Object.create(originalHost) as TS.LanguageServiceHost

		// This internal tsserver hook synchronizes only its original service.
		// Hiding it makes the secondary service build its own mirror Program.
		Object.defineProperty(host, 'updateFromProject', {value: undefined})

		host.getScriptSnapshot = fileName => this.getSnapshot(fileName, originalHost)
		host.getScriptVersion = fileName => originalHost.getScriptVersion(fileName)

		if (originalHost.getProjectVersion) {
			host.getProjectVersion = () => originalHost.getProjectVersion!()
		}

		return host
	}

	/** Get a mirror snapshot or delegate files outside the current Program. */
	private getSnapshot(fileName: string, originalHost: TS.LanguageServiceHost): TS.IScriptSnapshot | undefined {
		let program = this.context.program
		this.pruneSources(program)

		let sourceFile = program.getSourceFile(fileName)
		if (!sourceFile) {
			return originalHost.getScriptSnapshot(fileName)
		}

		if (!isMirrorableSourceFile(program, sourceFile)) {
			return originalHost.getScriptSnapshot(fileName)
				?? ts.ScriptSnapshot.fromString(sourceFile.text)
		}

		let source = this.getMirrorSource(sourceFile, originalHost)
		return source.snapshot
	}

	/** Build one source mirror and reuse it across equivalent Program revisions. */
	private getMirrorSource(sourceFile: TS.SourceFile, originalHost: TS.LanguageServiceHost): MirrorSource {
		let canonicalName = this.canonicalize(sourceFile.fileName)
		let cached = this.sourcesByFile.get(canonicalName)

		if (cached && (cached.sourceFile === sourceFile || cached.sourceText === sourceFile.text)) {
			cached.sourceFile = sourceFile
			return cached
		}

		let document = buildTypeScriptMirror(ts, this.context.program, sourceFile)

		let originalSnapshot = originalHost.getScriptSnapshot(sourceFile.fileName)

		let snapshot = document
			? ts.ScriptSnapshot.fromString(document.mirrorText)
			: originalSnapshot ?? ts.ScriptSnapshot.fromString(sourceFile.text)
			
		let source = {
			sourceFile,
			sourceText: sourceFile.text,
			document,
			snapshot,
		}

		this.sourcesByFile.set(canonicalName, source)
		return source
	}

	/** Get the mirror document for a file in the current real Program. */
	private getDocument(fileName: string): MirrorDocument | null {
		let program = this.context.program
		this.pruneSources(program)

		let sourceFile = program.getSourceFile(fileName)
		if (!sourceFile || !isMirrorableSourceFile(program, sourceFile)) {
			return null
		}

		return this.getMirrorSource(sourceFile, this.context.languageServiceHost).document
	}

	/** Remove mirror sources that no longer belong to the current real Program. */
	private pruneSources(program: TS.Program) {
		if (program === this.sourcesProgram) {
			return
		}

		this.sourcesProgram = program

		let currentFiles = new Set(
			program.getSourceFiles().map(sourceFile => this.canonicalize(sourceFile.fileName))
		)

		for (let fileName of this.sourcesByFile.keys()) {
			if (!currentFiles.has(fileName)) {
				this.sourcesByFile.delete(fileName)
			}
		}
	}

	/** Canonicalize a filename using the real project host policy. */
	private canonicalize(fileName: string): string {
		let canonicalize = this.context.languageServiceHost.useCaseSensitiveFileNames?.()
			? (value: string) => value
			: (value: string) => value.toLowerCase()

		return canonicalize(ts.sys.resolvePath(fileName)).replace(/\\/g, '/')
	}
}


/** Whether a source belongs to the application and may require a mirror. */
export function isMirrorableSourceFile(program: TS.Program, sourceFile: TS.SourceFile): boolean {
	return !sourceFile.isDeclarationFile
		&& !program.isSourceFileDefaultLibrary(sourceFile)
		&& !program.isSourceFileFromExternalLibrary(sourceFile)
}
