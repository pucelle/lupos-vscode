import type * as TS from 'typescript'
import {LuposBinding} from './types'
import {Helper} from '../../lupos-ts-module'
import {ts} from '../../core'


/** Walk and Discover all lupos bindings from a given node and it's children. */
export function analyzeLuposBindings(sourceFile: TS.SourceFile, helper: Helper): LuposBinding[] {
	let components: LuposBinding[] = []

	// Only visit root class declarations.
	ts.forEachChild(sourceFile, (node: TS.Node) => {
		if (ts.isClassDeclaration(node)
			&& node.name
			&& helper.class.isDerivedOf(node, 'Binding', '@pucelle/lupos.js')
		) {
			components.push({
				name: node.name.text,
				nameNode: node.name,
				declaration: node,
				type: helper.types.typeOf(node),
				description: helper.getNodeDescription(node),
				sourceFile,
			})
		}
	})

	return components
}
