import type TS from 'typescript'
import {getScriptElementKind, getSymbolDisplayPartKind} from './kind'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../lupos-ts-module'
import {CompletionItem} from '../../complete-data'
import {ts} from '../../core'


export function makeQuickInfo(item: CompletionItem | undefined, part: TemplatePart, piece: TemplatePartPiece): TS.QuickInfo | undefined{
	if (!item?.description) {
		return undefined
	}

	let kind = getScriptElementKind(item, part, piece)
	
	let textSpan: TS.TextSpan = {
		start: piece.start,
		length: piece.end - piece.start,
	}

	let headers: TS.SymbolDisplayPart[] = []
	let documentation: TS.SymbolDisplayPart[] = []
	let headerText: string
	
	if (piece.type === TemplatePartPieceType.TagName) {
		headerText = `<${part.node.tagName!}>`
	}
	else if (piece.type === TemplatePartPieceType.AttrValue) {
		headerText = item.name
	}
	else if (piece.type === TemplatePartPieceType.Modifier) {
		headerText = '.' + item.name
	}
	else {
		headerText = (part.namePrefix || '') + part.mainName!
	}

	headers.push({
		kind: ts.SymbolDisplayPartKind[getSymbolDisplayPartKind(part, piece)],
		text: headerText,
	})

	if (item.description) {
		documentation.push({
			kind: 'text',
			text: item.description,
		})
	}

	let info: TS.QuickInfo = {
		kind,
		kindModifiers: '',
		textSpan,
		displayParts: headers,
		documentation,
	}

	return info
}

