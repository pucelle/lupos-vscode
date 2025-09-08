import type * as TS from 'typescript'
import {getScriptElementKind} from './kind'
import {TemplatePart, TemplatePartPiece} from '../../lupos-ts-module'
import {ts} from '../../core'


export interface DefinitionItem {
	readonly kind?: TS.ScriptElementKind
	readonly name: string
	readonly nameNode: TS.Node
}


export function makeDefinitionInfo(item: DefinitionItem | undefined, part: TemplatePart, piece: TemplatePartPiece): TS.DefinitionInfoAndBoundSpan | undefined{
	if (!item) {
		return undefined
	}

	let nameNode = item.nameNode
	let name = item.name
	let kind = getScriptElementKind(item, part, piece)
	let fileName = nameNode.getSourceFile().fileName

	let textSpan: TS.TextSpan = {
		start: nameNode.getStart(),
		length: nameNode.getWidth(),
	}

	let info: TS.DefinitionInfo = {
		textSpan,
		fileName,
		kind,
		name,
		containerName: fileName,
		containerKind: ts.ScriptElementKind.scriptElement,
	}

	// Not include modifiers.
	let length = piece.end - piece.start

	let fromTextSpan = {
		start: piece.start,
		length,
	}

	return {
		definitions: [info],
		textSpan: fromTextSpan,
	}
}