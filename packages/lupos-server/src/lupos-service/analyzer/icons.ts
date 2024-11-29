import type * as TS from 'typescript'
import {Helper} from '../../lupos-ts-module'
import {ts} from '../../core'


export interface LuposIcon {
	name: string
	declaration: TS.ImportDeclaration
	description: string | null
}


/** Analyze imported svg icons from `import XXX from '...svg'`. */
export function analyzeLuposIcons(sourceFile: TS.SourceFile, helper: Helper): LuposIcon[] {
	let icons: LuposIcon[] = []

	// Only visit root class declarations.
	ts.forEachChild(sourceFile, (node: TS.Node) => {
		if (!ts.isImportDeclaration(node) || !node.moduleSpecifier) {
			return
		}

		if (/\.svg['"]/.test(node.moduleSpecifier.getText())) {
			icons.push({
				name: node.moduleSpecifier.getText().match(/([\w-]+)\.svg['"]/)?.[1] || '',
				declaration: node,
				description: helper.getNodeDescription(node),
			})
		}
	})

	return icons
}
