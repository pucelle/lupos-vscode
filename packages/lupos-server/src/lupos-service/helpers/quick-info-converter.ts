import type * as TS from 'typescript'
import {getScriptElementKind, getSymbolDisplayPartKind} from './kind'
import {Helper, TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../../lupos-ts-module'


export interface QuickInfoItem {
	readonly name: string
	readonly description: string
	readonly nameNode?: TS.Node
	readonly kind?: TS.ScriptElementKind
}


export function makeQuickInfo(item: QuickInfoItem | undefined, part: TemplatePart, piece: TemplatePartPiece, helper: Helper): TS.QuickInfo | undefined{
	if (!item || (!item.nameNode && !item.description)) {
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
	else {
		headerText = (part.namePrefix || '') + part.mainName!
	}

	if (item.nameNode) {
		if (piece.type === TemplatePartPieceType.Name && part.type !== TemplatePartType.Binding
			|| piece.type === TemplatePartPieceType.AttrValue
		) {
			headerText += ': ' + helper.types.getTypeFullText(helper.types.typeOf(item.nameNode))
		}
	}

	headers.push({
		kind: helper.ts.SymbolDisplayPartKind[getSymbolDisplayPartKind(part, piece)],
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

