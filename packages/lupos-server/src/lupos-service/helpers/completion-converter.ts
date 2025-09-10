import * as TS from 'typescript'
import {CompletionItem} from '../../complete-data'
import {getScriptElementKind} from './kind'
import {TemplatePart, TemplatePartPiece, TemplatePartType} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {WorkSpaceAnalyzer} from '../analyzer'


export function makeCompletionInfo(
	items: CompletionItem[],
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	analyzer: WorkSpaceAnalyzer
): TS.CompletionInfo {
	let entries: TS.CompletionEntry[] = items.map(item => {
		let kind = getScriptElementKind(item, part, piece)
		let start = item.start ?? piece.start + (part.namePrefix?.length ?? 0)
		let end = item.end ?? piece.end

		let importPath: string | undefined
		let ref = template.getReferenceByName(item.name)
		if (!ref) {
			let sourceFile = getImportSourceFile(part, item.name, analyzer)
			if (sourceFile) {
				importPath = analyzer.exports.getBestImportPath(item.name, sourceFile, template.sourceFile)
			}
		}

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
			labelDetails: {description: importPath},
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
	items: CompletionItem[],
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	name: string,
	analyzer: WorkSpaceAnalyzer
): TS.CompletionEntryDetails | undefined {
	let item = items.find(item => item.name === name)
	if (!item) {
		return undefined
	}

	let importPath: string | undefined
	let fileTextChange: TS.FileTextChanges | undefined

	let ref = template.getReferenceByName(item.name)
	if (!ref) {
		let sourceFile = getImportSourceFile(part, name, analyzer)
		if (sourceFile) {
			let changeAndPath = analyzer.exports.getImportPathAndTextChange(name, sourceFile, template.sourceFile)
			if (changeAndPath) {
				importPath = changeAndPath.importPath
				fileTextChange = changeAndPath.fileTextChange
			}
		}
	}

	let kind = getScriptElementKind(item, part, piece)

	let displayParts = item.detail ? [{
		kind: 'text',
		text: item.name + ': ' + item.detail,
	}] : []

	let documentation = item.description ? [{
		kind: 'text',
		text: item.description,
	}] : []

	let codeAction: TS.CodeAction | undefined = importPath ? {
		description: `Add import from "${importPath}"`,
		changes: fileTextChange ? [fileTextChange] : [],
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


export function getImportSourceFile(
	part: TemplatePart,
	name: string,
	analyzer: WorkSpaceAnalyzer
): TS.SourceFile | undefined {

	let sourceFile: TS.SourceFile | undefined

	// If input `<`, may also search
	if (part.type === TemplatePartType.Component || part.type === TemplatePartType.NormalStartTag) {
		let component = analyzer.getComponentsForCompletion(name)?.find(c => c.name === name)
		sourceFile = component?.sourceFile
	}
	else if (part.type === TemplatePartType.Binding) {
		let binding = analyzer.getBindingsForCompletion(name)?.find(c => c.name === name)
		sourceFile = binding?.sourceFile
	}

	return sourceFile
}