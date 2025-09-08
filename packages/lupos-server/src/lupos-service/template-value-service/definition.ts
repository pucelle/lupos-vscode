import {Helper, TemplatePart, TemplatePartPiece} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {inferMemberType} from './helpers/infer-member-type'
import {WorkSpaceAnalyzer} from '../analyzer'
import {inferTemplateValueMember, TemplateValueMemberInferred} from './infer-member'
import {DefinitionItem} from '../helpers/definition-converter'


/** Get definition for template value, typescript part. */
export function getTemplateValueDefinitionItem(
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	temOffset: number,
	analyzer: WorkSpaceAnalyzer
): DefinitionItem | undefined {
	let helper = analyzer.helper
	let inferred = inferTemplateValueMember(part, piece, template, temOffset, analyzer)

	if (!inferred) {
		return undefined
	}

	return getDefinitionItem(inferred, helper)
}


function getDefinitionItem(inferred: TemplateValueMemberInferred, helper: Helper): DefinitionItem | undefined {
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

	let item: DefinitionItem = {
		name,
		nameNode,
		kind: ts.ScriptElementKind.memberVariableElement,
	}

	return item
}
