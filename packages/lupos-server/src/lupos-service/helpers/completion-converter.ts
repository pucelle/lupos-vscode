import * as TS from 'typescript'
import {CompletionItem} from '../../complete-data'
import {getScriptElementKind} from './kind'
import {TemplatePart, TemplatePartPiece} from '../../lupos-ts-module'
import {ImportPathAndTextChange} from '../analyzer'


export function makeCompletionInfo(
	items: CompletionItem[],
	part: TemplatePart,
	piece: TemplatePartPiece
): TS.CompletionInfo {
	let entries: TS.CompletionEntry[] = items.map(item => {
		let kind = getScriptElementKind(item, part, piece)
		let start = item.start ?? piece.start + (part.namePrefix?.length ?? 0)
		let end = item.end ?? piece.end

		let replacementSpan: TS.TextSpan = {
			start,
			length: end - start,
		}

		return {
			name: item.name,
			kind,
			sortText: String(item.order ?? 0),
			insertText: item.name,
			replacementSpan,
			labelDetails: {detail: item.infoDetail, description: item.infoDescription},
		} as TS.CompletionEntry
	})

	// Filter out repetitive items.
	let names: Set<string> = new Set()

	entries = entries.filter(item => {
		if (names.has(item.name)) {
			return false
		}

		names.add(item.name)
		return true
	})

	return {
		isGlobalCompletion: false,
		isMemberCompletion: false,
		isNewIdentifierLocation: false,
		entries: entries,
	}
}


export function makeCompletionEntryDetails(
	item: CompletionItem,
	part: TemplatePart,
	piece: TemplatePartPiece,
	pathChange: ImportPathAndTextChange | undefined,
): TS.CompletionEntryDetails | undefined {
	let kind = getScriptElementKind(item, part, piece)

	let displayParts = item.detail ? [{
		kind: 'text',
		text: item.name + ': ' + item.detail,
	}] : []

	let documentation = item.description ? [{
		kind: 'text',
		text: item.description,
	}] : []

	let codeAction: TS.CodeAction | undefined = pathChange ? {
		description: `Add import from "${pathChange.importPath}"`,
		changes: [pathChange.textChange],
	} : undefined

	return {
		name: item.name,
		kindModifiers: kind || 'declare',
		kind: kind,
		displayParts,
		documentation,
		tags: [],
		codeActions: codeAction ? [codeAction] : undefined,
	}
}
