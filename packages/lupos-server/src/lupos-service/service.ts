import * as TS from 'typescript'
import {LuposAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {FlitQuickInfo} from './quickinfo'
import {FlitDefinition} from './definition'
import {ProjectContext} from '../core'
import {Template} from '../template-service'


/** Provide lupos language service for a single. */
export class LuposService {

	readonly context: ProjectContext

	private analyzer: LuposAnalyzer
	private completion: LuposCompletion
	private quickInfo: FlitQuickInfo
	private flitDefinition: FlitDefinition

	constructor(context: ProjectContext) {
		this.context = context
		this.analyzer = new LuposAnalyzer(context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new FlitQuickInfo(this.analyzer)
		this.flitDefinition = new FlitDefinition(this.analyzer)
	}

	/** Make sure to reload changed source files. */
	private beFresh() {
		this.analyzer.update()
	}

	getCompletions(template: Template, temOffset: number): TS.CompletionInfo | null {

		// `<|`
		if (template.content[temOffset - 1] === '<'
			&& (temOffset === template.content.length - 1 || !/\w/.test(template.content[temOffset + 1]))
		) {
			this.beFresh()
			return this.completion.getEmptyNameStartTagCompletions()
		}

		// `<N|`
		let slot = template.getSlotAt(temOffset)
		if (!slot) {
			return null
		}

		this.beFresh()

		return this.completion.getSlotCompletions(slot)
	}

	getNonTemplateCompletions(fileName: string, offset: number): TS.CompletionInfo | null {
		return this.completion.getNonTemplateCompletions(fileName, offset)
	}

	getQuickInfo(template: Template, offset: number): TS.QuickInfo | null {
		let token = this.scanner.scanAt(context.document, position)
		if (!token) {
			return null
		}

		// <
		if (token.type === FlitTokenType.StartTagOpen) {
			return null
		}

		this.beFresh()
		
		return this.quickInfo.getQuickInfo(token, context.node)
	}

	getNonTemplateQuickInfo(fileName: string, offset: number): TS.QuickInfo | null {
		return this.quickInfo.getNonTemplateQuickInfo(fileName, offset)
	}

	getDefinition(template: Template, offset: number): TS.DefinitionInfoAndBoundSpan | null {
		let token = this.scanner.scanAt(context.document, position)
		if (!token) {
			return null
		}

		// `<` or `@@`
		if (token.type === FlitTokenType.StartTagOpen
			|| token.type === FlitTokenType.StartTag && !token.tagName.includes('-')
			|| token.type === FlitTokenType.DomEvent
		) {
			return null
		}

		this.beFresh()
		
		return this.flitDefinition.getDefinition(token, context.node)
	}
}