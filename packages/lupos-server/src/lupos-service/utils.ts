import {CompletionItem} from '../complete-data'
import {ts} from '../core'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType, TemplateSlotPlaceholder} from '../lupos-ts-module'
import type * as TS from 'typescript'


export function getScriptElementKind(
	item: CompletionItem,
	part: TemplatePart | undefined,
	piece: TemplatePartPiece
): TS.ScriptElementKind {
	if (!part) {
		return ts.ScriptElementKind.classElement
	}

	if (item.kind !== undefined) {
		return item.kind
	}

	switch (part.type) {
		case TemplatePartType.Component:
		case TemplatePartType.DynamicComponent:
			return ts.ScriptElementKind.classElement

		case TemplatePartType.FlowControl:
			return ts.ScriptElementKind.keyword
		
		case TemplatePartType.SlotTag:
		case TemplatePartType.NormalStartTag:

			// For `<|`
			if (!part.node.tagName) {
				if (TemplateSlotPlaceholder.isComponent(item.name)) {
					return ts.ScriptElementKind.classElement
				}
				else if (item.name.startsWith('lu:')) {
					return ts.ScriptElementKind.keyword
				}
			}

			return ts.ScriptElementKind.string
		
		case TemplatePartType.Binding:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.classElement
			}
			else {
				return ts.ScriptElementKind.string
			}
		
		case TemplatePartType.Property:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.Event:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.functionElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		default:
			return ts.ScriptElementKind.unknown
	}
}


export function getSymbolDisplayPartKind(part: TemplatePart, piece: TemplatePartPiece): TS.SymbolDisplayPartKind {
	switch (part.type) {
		case TemplatePartType.Component:
		case TemplatePartType.DynamicComponent:
		case TemplatePartType.SlotTag:
		case TemplatePartType.FlowControl:
			return ts.SymbolDisplayPartKind.className

		case TemplatePartType.NormalStartTag:
			return ts.SymbolDisplayPartKind.text
	
		case TemplatePartType.Binding:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.className
			}
			else {
				return ts.SymbolDisplayPartKind.propertyName
			}

		case TemplatePartType.Property:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		case TemplatePartType.Event:
			
			// DOM element event will be overwritten outside.
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.functionName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}
	
		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		default:
			return ts.SymbolDisplayPartKind.text
	}
}


/** Get relative path. */
export function pathRelative(currentPath: string, targetPath: string): string | undefined {
	let currentPieces = currentPath.split('/')
	let targetPieces = targetPath.split('/')

	if (targetPieces[0] !== currentPieces[0]) {
		return undefined
	}

	let index = 1
	let maxIndex = Math.min(targetPieces.length, currentPieces.length)

	while (index < maxIndex && targetPieces[index] === currentPieces[index]) {
		index++
	}

	// Use dir path.
	let currentRelativePieces = currentPieces.slice(index, currentPieces.length - 1).map(() => '..')
	let targetRelativePieces = targetPieces.slice(index)

	if (currentRelativePieces.length === 0) {
		currentRelativePieces.push('.')
	}

	return [...currentRelativePieces, ...targetRelativePieces].join('/')
}


/** Join path. */
export function pathJoin(currentPath: string, relativePath: string): string | undefined {
	let currentPieces = currentPath.split('/')
	let relativePieces = relativePath.split('/')
	let currentEndIndex = currentPieces.length - 1
	let relativeStartIndex = 0

	for (; relativeStartIndex < relativePieces.length; relativeStartIndex++) {
		let relativePiece = relativePieces[relativeStartIndex]
		if (relativePiece === '.') {
			continue
		}
		else if (relativePiece === '..') {
			currentEndIndex--
		}
		else {
			break
		}
	}

	return [...currentPieces.slice(0, currentEndIndex), ...relativePieces.slice(relativeStartIndex)].join('/')
}