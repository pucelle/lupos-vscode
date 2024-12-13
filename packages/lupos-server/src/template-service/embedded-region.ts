import {HTMLDocument, Position} from 'vscode-html-languageservice'
import {Stylesheet} from 'vscode-css-languageservice'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {SharedCSSService, SharedHTMLService} from '../shared-services/shared-html-css-services'
import {OriginTranslator} from './types'


export class TemplateEmbeddedRegion implements OriginTranslator {

	/** Region language. */
	languageId: 'html' | 'css'

	/** Document of embedded content. */
	document: TextDocument
	
	/** Start offset, relative to template virtual document. */
	start: number
	
	/** End offset, relative to template virtual document. */
	end: number

	/** 
	 * If modified the document, it's the offset to transform
	 * current document offset to outer template virtual document.
	 */
	offset: number

	/** Parsed stylesheet. */
	stylesheet: Stylesheet | null

	/** Parsed HTML document. */
	htmlDocument: HTMLDocument | null

	constructor(content: string, languageId: 'html' | 'css', start: number, end: number, offset: number) {
		let document = TextDocument.create(`untitled://embedded.${languageId}`, languageId, 1, content)
		let htmlDocument = languageId === 'html' ? SharedHTMLService.parseHTMLDocument(document) : null
		let stylesheet = languageId === 'css' ? SharedCSSService.parseStylesheet(document) : null
		
		this.languageId = languageId
		this.document = document
		this.start = start
		this.end = end
		this.offset = offset
		this.htmlDocument = htmlDocument
		this.stylesheet = stylesheet
	}

	/** Transfer a template offset to local offset of region. */
	templateOffsetToLocal(temOffset: number): number {
		return temOffset - this.start - this.offset
	}

	/** Transfer a local offset of region to template offset. */
	localOffsetToTemplate(localOffset: number): number {
		return localOffset + this.start + this.offset
	}

	/** Transfer a local offset to equivalent local position. */
	localOffsetToPosition(localOffset: number): Position {
		return this.document.positionAt(localOffset)
	}

	/** Transfer a local position to equivalent local offset. */
	localPositionToOffset(localOffset: Position): number {
		return this.document.offsetAt(localOffset)
	}
}
