import type TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {LuposQuickInfo} from './quick-info'
import {LuposDefinition} from './definition'
import {ProjectContext} from '../core'
import {Template} from '../template-service'
import {DiagnosticModifier, getTemplatePartPieceAt, TemplateDiagnostics} from '../lupos-ts-module'
import {LuposCodeFixes} from './code-fixes'
import {LuposRename} from './rename'
import {TemplateProvider} from '../template-service/template-provider'
import {LuposReferences} from './references'


/** Provide lupos language service for a single. */
export class LuposService {

	readonly context: ProjectContext

	private analyzer: WorkSpaceAnalyzer
	private completion: LuposCompletion
	private quickInfo: LuposQuickInfo
	private definition: LuposDefinition
	private diagnostics: TemplateDiagnostics
	private codeFixes: LuposCodeFixes
	private rename: LuposRename
	private references: LuposReferences
	private freshing: boolean = false

	constructor(context: ProjectContext, templateProvider: TemplateProvider) {
		this.context = context
		this.analyzer = new WorkSpaceAnalyzer(context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new LuposQuickInfo(this.analyzer)
		this.definition = new LuposDefinition(this.analyzer)
		this.diagnostics = new TemplateDiagnostics(this.analyzer)
		this.codeFixes = new LuposCodeFixes(this.analyzer)
		this.rename = new LuposRename(this.analyzer, templateProvider)
		this.references = new LuposReferences(this.analyzer, templateProvider)
	}

	/** Make sure to reload changed source files. */
	private beFresh() {
		if (this.freshing) {
			return
		}

		// Keep fresh for a micro task tick after updated.
		this.analyzer.update()
		this.freshing = true

		Promise.resolve().then(() => {
			this.freshing = false
		})
	}

	getCompletionInfo(template: Template, temOffset: number, gloOffset: number): TS.CompletionInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletionInfo(part, piece, template, gloOffset)
	}

	getCompletionEntryDetails(template: Template, temOffset: number, gloOffset: number, name: string): TS.CompletionEntryDetails | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletionEntryDetails(part, piece, template, gloOffset, name)
	}

	getQuickInfo(template: Template, temOffset: number, gloOffset: number): TS.QuickInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		
		return this.quickInfo.getQuickInfo(part, piece, template, gloOffset)
	}

	getDefinition(template: Template, temOffset: number, gloOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		
		return this.definition.getDefinition(part, piece, template, gloOffset)
	}

	modifyDiagnostics(template: Template, modifier: DiagnosticModifier) {
		this.beFresh()
		this.diagnostics.diagnoseHTMLSyntax(template, modifier)
		this.diagnostics.diagnoseFunctionContextTemplate(template, modifier)
		this.diagnostics.diagnose(template.parts, template, modifier)
	}

	augmentReferences(symbols: TS.ReferencedSymbol[] | undefined) {
		this.beFresh()
		return this.references.augment(symbols)
	}

	getReferences(template: Template, temOffset: number) {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		return this.references.findReferences(part, piece, template)
	}

	modifyRenameInfo(fileName: string, position: number, info: TS.RenameInfo) {
		this.beFresh()
		return this.rename.modifyRenameInfo(fileName, position, info)
	}

	augmentRenameLocations(
		fileName: string,
		position: number,
		locations: readonly TS.RenameLocation[] | undefined
	) {
		this.beFresh()
		return this.rename.augmentRenameLocations(fileName, position, locations)
	}

	getRenameInfo(template: Template, temOffset: number, preferences?: TS.UserPreferences | TS.RenameInfoOptions) {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		return this.rename.getRenameInfo(part, piece, template, preferences)
	}

	findRenameLocations(
		template: Template,
		temOffset: number,
		findInStrings: boolean,
		findInComments: boolean,
		preferences?: boolean | TS.UserPreferences
	) {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		
		return this.rename.findRenameLocations(
			part,
			piece,
			template,
			findInStrings,
			findInComments,
			preferences
		)
	}

	getCodeFixesAtPosition(template: Template, temOffset: number, errorCodes: ReadonlyArray<number>): TS.CodeFixAction[] | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.codeFixes.getCodeFixes(part, piece, template, errorCodes)
	}
}
