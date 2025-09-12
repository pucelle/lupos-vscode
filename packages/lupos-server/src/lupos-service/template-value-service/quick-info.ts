import {Helper, TemplatePart, TemplatePartPiece} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {inferMemberType} from './helpers/infer-member-type'
import {WorkSpaceAnalyzer} from '../analyzer'
import {inferTemplateValueMember, TemplateValueMemberInferred} from './infer-member'
import {QuickInfoItem} from '../helpers/quick-info-converter'


/** Get quick info for template value, typescript part. */
export function getTemplateValueQuickInfoItem(
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	gloOffset: number,
	analyzer: WorkSpaceAnalyzer
): QuickInfoItem | undefined {
	let helper = analyzer.helper
	let node = template.getNodeAtOffset(gloOffset)
	let inferred = inferTemplateValueMember(part, piece, template, node, analyzer)
	
	if (!inferred) {
		return undefined
	}

	return getQuickInfoItem(inferred, helper)
}


function getQuickInfoItem(inferred: TemplateValueMemberInferred, helper: Helper): QuickInfoItem | undefined {
	let {node, valueNode, valueType} = inferred
	let ts = helper.ts

	let memberType = inferMemberType(node, valueNode, valueType, helper)
	if (!memberType) {
		return undefined
	}

	let nameNode = memberType.member?.name
	if (!nameNode) {
		return undefined
	}

	let name = helper.getText(nameNode)
	let description = helper.getNodeDescription(memberType.member!) ?? ''

	let item: QuickInfoItem = {
		name,
		nameNode,
		description,
		kind: ts.ScriptElementKind.memberVariableElement,
	}

	return item
}
