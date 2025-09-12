import {Position} from 'vscode-languageserver-types'
import {Template} from './template'
import type * as TS from 'typescript'
import {DiagnosticModifier} from '../lupos-ts-module'


/** 
 * Extends from `ts.LanguageService`,
 * but provide a `TemplateContext` parameter.
 * 
 * This type includes all available service,
 * can choose to implement part of them.
 */
export interface TemplateLanguageService {

	getCompletionsAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
		options?: TS.GetCompletionsAtPositionOptions
	): TS.CompletionInfo | undefined

	getCompletionEntryDetails?(
		template: Template,
		temOffset: number,
		gloOffset: number,
		name: string,
		options?: TS.FormatCodeSettings
	): TS.CompletionEntryDetails | undefined

	getQuickInfoAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
	): TS.QuickInfo | undefined

	/** Returned definition should be fit with global document. */
	getDefinitionAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
	): TS.DefinitionInfo[]
	
	/** Returned definition should be fit with global document. */
	getDefinitionAndBoundSpan?(
		template: Template,
		temOffset: number,
		gloOffset: number,
	): TS.DefinitionInfoAndBoundSpan | undefined

	getSyntacticDiagnostics?(
		template: Template
	): TS.Diagnostic[]

	modifySemanticDiagnostics?(
		template: Template,
		modifier: DiagnosticModifier
	): void

	getFormattingEditsForRange?(
		template: Template,
		start: number,
		end: number,
		settings: TS.EditorSettings
	): TS.TextChange[]

	getSupportedCodeFixes?(): number[]

	getCodeFixesAtPosition?(
		template: Template,
		start: number,
		end: number,
		errorCodes: ReadonlyArray<number>,
		formatOptions: TS.FormatCodeSettings,
		preferences: TS.UserPreferences
	): TS.CodeFixAction[]

	getSignatureHelpItemsAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
		options?: TS.SignatureHelpItemsOptions
	): TS.SignatureHelpItems | undefined

	getOutliningSpans?(
		template: Template
	): TS.OutliningSpan[]

	getReferencesAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
	): TS.ReferencedSymbol[] | undefined

	getJsxClosingTagAtPosition?(
		template: Template,
		temOffset: number,
		gloOffset: number,
	): TS.JsxClosingTagInfo | undefined
}


/** Can translate between position and offset. */
export interface OriginTranslator {

	/** Convert template offset to local offset. */
	templateOffsetToLocal(templateOffset: number): number

	/** Convert local offset to template offset. */
	localOffsetToTemplate(localOffset: number): number

	/** Transfer a local offset to equivalent local position. */
	localOffsetToPosition(localOffset: number): Position

	/** Transfer a local position to equivalent local offset. */
	localPositionToOffset(localOffset: Position): number
}