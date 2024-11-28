import * as ts from 'typescript'
import {FlitTokenScanner, FlitTokenType} from './toker-scanner'
import {LanguageService as HTMLLanguageService} from 'vscode-html-languageservice'
import {LuposAnalyzer} from './analyzer/analyzer'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {TemplateContext} from '../shared-services'
import {FlitCompletion} from './completion'
import {FlitQuickInfo} from './quickinfo'
import {FlitDefinition} from './definition'
import {ProjectContext} from '../core'


/** Provide lupos language service. */
export class LuposService {

	readonly context: ProjectContext

	private scanner: FlitTokenScanner
	private analyzer: LuposAnalyzer
	private completion: FlitCompletion
	private quickInfo: FlitQuickInfo
	private flitDefinition: FlitDefinition

	constructor(context: ProjectContext) {
		this.context = context

		this.scanner = new FlitTokenScanner(htmlService)
		this.analyzer = new LuposAnalyzer(context.service)

		this.completion = new FlitCompletion(this.analyzer)
		this.quickInfo = new FlitQuickInfo(this.analyzer)
		this.flitDefinition = new FlitDefinition(this.analyzer)
	}

	/** Make sure to reload changed source files. */
	private beFresh() {
		this.analyzer.update()
	}

	getCompletions(context: TemplateContext, offset: number): ts.CompletionInfo | null {
		let token = this.scanner.scanAt(context.document, position)
		if (!token) {
			return null
		}

		this.beFresh()

		return this.completion.getCompletions(token, context.node)
	}

	getNonTemplateCompletions(fileName: string, offset: number): ts.CompletionInfo | null {
		return this.completion.getNonTemplateCompletions(fileName, offset)
	}

	getQuickInfo(context: TemplateContext, offset: number): ts.QuickInfo | null {
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

	getNonTemplateQuickInfo(fileName: string, offset: number): ts.QuickInfo | null {
		return this.quickInfo.getNonTemplateQuickInfo(fileName, offset)
	}

	getDefinition(context: TemplateContext, offset: number): ts.DefinitionInfoAndBoundSpan | null {
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