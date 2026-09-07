import type TS from 'typescript'
import {MirrorCapability} from '../lupos-ts-module'
import {MirrorLanguageService} from './mirror-language-service'


/** Maps TypeScript language-service results from mirror files to real sources. */
export class MirrorResultMapper {

	/** Mirror service owning all source mappings. */
	private readonly mirror: MirrorLanguageService

	constructor(mirror: MirrorLanguageService) {
		this.mirror = mirror
	}

	/** Map completion replacement spans to the request file. */
	mapCompletionInfo(fileName: string, info: TS.CompletionInfo | undefined): TS.CompletionInfo | undefined {
		if (!info) {
			return undefined
		}

		return {
			...info,
			optionalReplacementSpan: this.mapOptionalSpan(fileName, info.optionalReplacementSpan, 'completion'),
			entries: info.entries.map(entry => ({
				...entry,
				replacementSpan: this.mapOptionalSpan(fileName, entry.replacementSpan, 'completion'),
			})),
		}
	}

	/** Map completion details and every included source edit. */
	mapCompletionDetails(details: TS.CompletionEntryDetails | undefined): TS.CompletionEntryDetails | undefined {
		if (!details) {
			return undefined
		}

		let codeActions = details.codeActions?.map(action => this.mapCodeAction(action, 'completion'))
			.filter((action): action is TS.CodeAction => !!action)

		return {...details, codeActions}
	}

	/** Map quick-info display range. */
	mapQuickInfo(fileName: string, info: TS.QuickInfo | undefined): TS.QuickInfo | undefined {
		let textSpan = info && this.mirror.mapSpan(fileName, info.textSpan, 'hover')
		return info && textSpan ? {...info, textSpan} : undefined
	}

	/** Map definitions and the bound source range. */
	mapDefinitionAndBoundSpan(
		fileName: string,
		result: TS.DefinitionInfoAndBoundSpan | undefined
	): TS.DefinitionInfoAndBoundSpan | undefined {
		if (!result) {
			return undefined
		}

		let textSpan = this.mirror.mapSpan(fileName, result.textSpan, 'definition')
		
		let definitions = result.definitions
			?.map(definition => this.mapDocumentSpan(definition, 'definition'))
			.filter((definition): definition is TS.DefinitionInfo => !!definition)

		return textSpan ? {...result, textSpan, definitions} : undefined
	}

	/** Map a definition list. */
	mapDefinitions(definitions: readonly TS.DefinitionInfo[] | undefined): readonly TS.DefinitionInfo[] | undefined {
		return definitions
			?.map(definition => this.mapDocumentSpan(definition, 'definition'))
			.filter((definition): definition is TS.DefinitionInfo => !!definition)
	}

	/** Map all spans in TypeScript reference groups. */
	mapReferencedSymbols(symbols: TS.ReferencedSymbol[] | undefined): TS.ReferencedSymbol[] | undefined {
		return symbols?.map(symbol => {
			let definition = this.mapDocumentSpan(symbol.definition, 'references')
			if (!definition) {
				return null
			}

			let references = symbol.references
				.map(reference => this.mapDocumentSpan(reference, 'references'))
				.filter((reference): reference is TS.ReferenceEntry => !!reference)

			return {...symbol, definition, references}
		}).filter((symbol): symbol is TS.ReferencedSymbol => !!symbol)
	}

	/** Map rename information to the request file. */
	mapRenameInfo(fileName: string, info: TS.RenameInfo): TS.RenameInfo {
		if (!info.canRename) {
			return info
		}

		let triggerSpan = this.mirror.mapSpan(fileName, info.triggerSpan, 'rename')
		return triggerSpan ? {...info, triggerSpan} : {
			canRename: false,
			localizedErrorMessage: 'The mirrored rename location cannot be mapped to the source file.',
		}
	}

	/** Map and deduplicate rename locations. */
	mapRenameLocations(locations: readonly TS.RenameLocation[] | undefined): readonly TS.RenameLocation[] | undefined {
		if (!locations) {
			return undefined
		}

		let seen = new Set<string>()

		return locations.map(location => this.mapDocumentSpan(location, 'rename'))
			.filter((location): location is TS.RenameLocation => {
				if (!location) {
					return false
				}

				let key = `${location.fileName}:${location.textSpan.start}:${location.textSpan.length}`
				if (seen.has(key)) {
					return false
				}

				seen.add(key)
				return true
			})
	}

	/** Map signature-help applicability to the request file. */
	mapSignatureHelp(fileName: string, items: TS.SignatureHelpItems | undefined): TS.SignatureHelpItems | undefined {
		let applicableSpan = items && this.mirror.mapSpan(fileName, items.applicableSpan, 'completion')
		return items && applicableSpan ? {...items, applicableSpan} : undefined
	}

	/** Map semantic diagnostics, including related information. */
	mapDiagnostics(diagnostics: readonly TS.Diagnostic[]): TS.Diagnostic[] {
		return diagnostics.map(diagnostic => this.mapDiagnostic(diagnostic))
			.filter((diagnostic): diagnostic is TS.Diagnostic => !!diagnostic)
	}

	/** Map code actions only when every contained source edit is safe. */
	mapCodeFixes(actions: readonly TS.CodeFixAction[]): TS.CodeFixAction[] {
		return actions.map(action => this.mapCodeAction(action, 'diagnostic'))
			.filter((action): action is TS.CodeFixAction => !!action)
	}

	/** Map a document span and its optional context ranges. */
	private mapDocumentSpan<T extends TS.DocumentSpan>(span: T, capability: MirrorCapability): T | null {
		let textSpan = this.mirror.mapSpan(span.fileName, span.textSpan, capability)
		if (!textSpan) {
			return null
		}

		let contextSpan = this.mapOptionalSpan(span.fileName, span.contextSpan, capability)
		let originalFileName = span.originalFileName ?? span.fileName
		let originalTextSpan = this.mapOptionalSpan(originalFileName, span.originalTextSpan, capability)
		let originalContextSpan = this.mapOptionalSpan(originalFileName, span.originalContextSpan, capability)

		return {...span, textSpan, contextSpan, originalTextSpan, originalContextSpan}
	}

	/** Map one diagnostic and its related information. */
	private mapDiagnostic(diagnostic: TS.Diagnostic): TS.Diagnostic | null {
		if (!diagnostic.file) {
			return diagnostic
		}

		let realFile = this.getRealSourceFile(diagnostic.file.fileName)
		if (diagnostic.start === undefined) {
			return realFile ? {...diagnostic, file: realFile} : diagnostic
		}

		let textSpan = this.mirror.mapSpan(diagnostic.file.fileName, {
			start: diagnostic.start,
			length: diagnostic.length ?? 0,
		}, 'diagnostic')

		if (!textSpan) {
			return null
		}

		let relatedInformation = diagnostic.relatedInformation
			?.map(related => this.mapDiagnostic(related) as TS.DiagnosticRelatedInformation | null)
			.filter((related): related is TS.DiagnosticRelatedInformation => !!related)

		return {
			...diagnostic,
			file: realFile ?? diagnostic.file,
			start: textSpan.start,
			length: textSpan.length,
			relatedInformation,
		}
	}

	/** Map a code action and reject partially mappable edit sets. */
	private mapCodeAction<T extends TS.CodeAction>(action: T, capability: MirrorCapability): T | null {
		let changes = action.changes.map(change => this.mapFileTextChanges(change, capability))
		if (changes.some(change => !change)) {
			return null
		}

		return {...action, changes: changes as TS.FileTextChanges[]}
	}

	/** Map all text changes belonging to one file. */
	private mapFileTextChanges(
		changes: TS.FileTextChanges,
		capability: MirrorCapability
	): TS.FileTextChanges | null {
		if (changes.isNewFile) {
			return changes
		}

		let textChanges = changes.textChanges.map(change => {
			let span = this.mirror.mapSpan(changes.fileName, change.span, capability)
			return span ? {...change, span} : null
		})

		if (textChanges.some(change => !change)) {
			return null
		}

		return {...changes, textChanges: textChanges as TS.TextChange[]}
	}

	/** Map an optional span without changing undefined fields. */
	private mapOptionalSpan(
		fileName: string,
		span: TS.TextSpan | undefined,
		capability: MirrorCapability
	): TS.TextSpan | undefined {
		return span ? this.mirror.mapSpan(fileName, span, capability) ?? undefined : undefined
	}

	/** Resolve the real SourceFile corresponding to a mirror diagnostic file. */
	private getRealSourceFile(fileName: string): TS.SourceFile | undefined {
		return this.mirror.getRealSourceFile(fileName)
	}
}
