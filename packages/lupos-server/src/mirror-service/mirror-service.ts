import type TS from 'typescript'
import {ProjectContext} from '../core'
import {MirrorCapability} from '../lupos-ts-module'
import {MirrorLanguageService} from './mirror-language-service'
import {MirrorResultMapper} from './mirror-result-mapper'


/** Routes TypeScript language-service requests through mapped mirror sources. */
export class MirrorService {

	/** Project-wide mirror TypeScript language service. */
	private readonly mirror: MirrorLanguageService

	/** Converts mirror service results back to real source coordinates. */
	private readonly mapper: MirrorResultMapper

	constructor(context: ProjectContext) {
		this.mirror = new MirrorLanguageService(context)
		this.mapper = new MirrorResultMapper(this.mirror)
	}

	/** Get mirror completions at a real source position. */
	getCompletionsAtPosition(
		fileName: string,
		position: number,
		options?: TS.GetCompletionsAtPositionOptions
	): TS.CompletionInfo | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'completion')
		if (mirrorPosition === null) {
			return undefined
		}

		let info = this.mirror.getTypeScriptService().getCompletionsAtPosition(fileName, mirrorPosition, options)
		return this.mapper.mapCompletionInfo(fileName, info)
	}

	/** Get mapped details for a completion selected at a real source position. */
	getCompletionEntryDetails(
		fileName: string,
		position: number,
		name: string,
		formatOptions?: TS.FormatCodeSettings,
		source?: string,
		preferences?: TS.UserPreferences,
		data?: TS.CompletionEntryData
	): TS.CompletionEntryDetails | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'completion')
		if (mirrorPosition === null) {
			return undefined
		}

		let details = this.mirror.getTypeScriptService().getCompletionEntryDetails(
			fileName,
			mirrorPosition,
			name,
			formatOptions,
			source,
			preferences,
			data
		)

		return this.mapper.mapCompletionDetails(details)
	}

	/** Get mapped TypeScript quick info. */
	getQuickInfoAtPosition(fileName: string, position: number): TS.QuickInfo | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'hover')
		if (mirrorPosition === null) {
			return undefined
		}

		let info = this.mirror.getTypeScriptService().getQuickInfoAtPosition(fileName, mirrorPosition)
		return this.mapper.mapQuickInfo(fileName, info)
	}

	/** Get mapped TypeScript definitions. */
	getDefinitionAtPosition(fileName: string, position: number): readonly TS.DefinitionInfo[] | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'definition')
		if (mirrorPosition === null) {
			return undefined
		}

		let definitions = this.mirror.getTypeScriptService().getDefinitionAtPosition(fileName, mirrorPosition)
		return this.mapper.mapDefinitions(definitions)
	}

	/** Get mapped TypeScript definitions and the originating bound span. */
	getDefinitionAndBoundSpan(fileName: string, position: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'definition')
		if (mirrorPosition === null) {
			return undefined
		}

		let result = this.mirror.getTypeScriptService().getDefinitionAndBoundSpan(fileName, mirrorPosition)
		return this.mapper.mapDefinitionAndBoundSpan(fileName, result)
	}

	/** Get mapped semantic diagnostics for a mirrored source. */
	getSemanticDiagnostics(fileName: string): TS.Diagnostic[] | undefined {
		if (!this.mirror.hasDocument(fileName)) {
			return undefined
		}

		let diagnostics = this.mirror.getTypeScriptService().getSemanticDiagnostics(fileName)
		return this.mapper.mapDiagnostics(diagnostics)
	}

	/** Get mapped signature help. */
	getSignatureHelpItems(
		fileName: string,
		position: number,
		options?: TS.SignatureHelpItemsOptions
	): TS.SignatureHelpItems | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'completion')
		if (mirrorPosition === null) {
			return undefined
		}

		let items = this.mirror.getTypeScriptService().getSignatureHelpItems(fileName, mirrorPosition, options)
		return this.mapper.mapSignatureHelp(fileName, items)
	}

	/** Get mapped TypeScript references. */
	findReferences(fileName: string, position: number): TS.ReferencedSymbol[] | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'references')
		if (mirrorPosition === null) {
			return undefined
		}

		let symbols = this.mirror.getTypeScriptService().findReferences(fileName, mirrorPosition)
		return this.mapper.mapReferencedSymbols(symbols)
	}

	/** Get mapped TypeScript rename information. */
	getRenameInfo(
		fileName: string,
		position: number,
		preferences?: TS.UserPreferences | TS.RenameInfoOptions
	): TS.RenameInfo | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'rename')
		if (mirrorPosition === null) {
			return undefined
		}

		let info = this.mirror.getTypeScriptService().getRenameInfo(fileName, mirrorPosition, preferences)
		let mapped = this.mapper.mapRenameInfo(fileName, info)

		if (mapped.canRename && this.hasNodeModulesReference(fileName, mirrorPosition)) {
			return {
				canRename: false,
				localizedErrorMessage: 'Cannot rename this symbol because it has references in node_modules.',
			}
		}

		return mapped
	}

	/** Get mapped TypeScript rename locations. */
	findRenameLocations(
		fileName: string,
		position: number,
		findInStrings: boolean,
		findInComments: boolean,
		preferences?: boolean | TS.UserPreferences
	): readonly TS.RenameLocation[] | undefined {
		let mirrorPosition = this.mapPosition(fileName, position, 'rename')
		if (mirrorPosition === null) {
			return undefined
		}

		if (this.hasNodeModulesReference(fileName, mirrorPosition)) {
			return undefined
		}

		let service = this.mirror.getTypeScriptService()
		let locations: readonly TS.RenameLocation[] | undefined

		if (typeof preferences === 'boolean' || preferences === undefined) {
			locations = service.findRenameLocations(
				fileName,
				mirrorPosition,
				findInStrings,
				findInComments,
				preferences
			)
		}
		else {
			locations = service.findRenameLocations(
				fileName,
				mirrorPosition,
				findInStrings,
				findInComments,
				preferences
			)
		}

		let mapped = this.mapper.mapRenameLocations(locations)
		return mapped?.some(location => this.isNodeModules(location.fileName))
			? undefined
			: mapped
	}

	/** Get mapped TypeScript code fixes for mirror diagnostics. */
	getCodeFixesAtPosition(
		fileName: string,
		start: number,
		end: number,
		errorCodes: readonly number[],
		formatOptions: TS.FormatCodeSettings,
		preferences: TS.UserPreferences
	): TS.CodeFixAction[] | undefined {
		let mirrorStart = this.mapPosition(fileName, start, 'diagnostic')
		let mirrorEnd = this.mapPosition(fileName, end, 'diagnostic')
		if (mirrorStart === null || mirrorEnd === null) {
			return undefined
		}

		let actions = this.mirror.getTypeScriptService().getCodeFixesAtPosition(
			fileName,
			mirrorStart,
			mirrorEnd,
			errorCodes,
			formatOptions,
			preferences
		)

		return this.mapper.mapCodeFixes(actions)
	}

	/** Dispose mirror resources. */
	dispose() {
		this.mirror.dispose()
	}

	/** Map a real position for one semantic capability. */
	private mapPosition(fileName: string, position: number, capability: MirrorCapability): number | null {
		return this.mirror.mapPosition(fileName, position, capability)
	}

	/** Whether the mirrored symbol has a declaration or reference in node_modules. */
	private hasNodeModulesReference(fileName: string, position: number): boolean {
		if (this.isNodeModules(fileName)) {
			return true
		}

		let symbols = this.mirror.getTypeScriptService().findReferences(fileName, position) ?? []

		return symbols.some(symbol => {
			return this.isNodeModules(symbol.definition.fileName)
				|| symbol.references.some(reference => this.isNodeModules(reference.fileName))
		})
	}

	/** Whether a normalized path belongs to an installed dependency. */
	private isNodeModules(fileName: string): boolean {
		return /(^|\/)node_modules(\/|$)/i.test(fileName.replace(/\\/g, '/'))
	}
}
