import type * as TS from 'typescript'
import {Template} from './template'
import {ts, ProjectContext, PluginConfig} from '../core'
import {WeakerPairKeysMap} from '../lupos-ts-module'


/** 
 * It helps to query template at specified position,
 * and make `Template` instances.
 */
export class TemplateProvider {

	readonly context: ProjectContext
	private readonly cache: TemplateContextCache = new TemplateContextCache()

	constructor(context: ProjectContext) {
		this.context = context
	}

	/** Get a TemplateContext from specified offset position of source file. */
	getTemplateAt(fileName: string, offset: number): Template | null {
		let sourceFile = this.context.projectHelper.getSourceFile(fileName)
		let taggedNode = this.getTaggedNodeAt(fileName, offset)

		if (!sourceFile || !taggedNode) {
			return null
		}

		let context = this.cache.get(sourceFile, taggedNode)

		if (!context) {
			context = this.createTemplate(taggedNode)
			this.cache.add(sourceFile, taggedNode, context)
		}

		return context
	}

	/** Get template node, but limit only the literal part. */
	private getTaggedNodeAt(fileName: string, position: number): TS.TaggedTemplateExpression | null {
		let currentNode = this.context.projectHelper.getNodeAtOffset(fileName, position)
		if (!currentNode) {
			return null
		}

		// `${a.b|...}` - If mouse is here, stop.
		if (!ts.isTemplateLiteralToken(currentNode)) {
			return null
		}

		// `${...|}` - If mouse is here, will capture a template tail node, stop too.
		if (ts.isTemplateMiddleOrTemplateTail(currentNode) && currentNode.getStart() === position) {
			return null
		}

		// Find html`...`
		let taggedNode = this.context.helper.findOutward(currentNode, ts.isTaggedTemplateExpression)

		// Must recheck tag kind.
		if (!taggedNode) {
			return null
		}

		// Check tag name is allowed.
		if (!PluginConfig.tags.includes(taggedNode.tag.getText())) {
			return null
		}

		return taggedNode
	}

	private createTemplate(taggedNode: TS.TaggedTemplateExpression) {
		let templateLiteral = taggedNode.template
		let tagName = taggedNode.tag.getText() as 'html' | 'css' | 'svg'

		return new Template(
			tagName,
			templateLiteral,
			this.context,
		)
	}

	/** Get all TemplateContext from source file. */
	getAllTemplates(fileName: string): Template[] {
		let sourceFile = this.context.projectHelper.getSourceFile(fileName)
		if (!sourceFile) {
			return []
		}

		let taggedNodes = this.context.helper.findAllInward(sourceFile, ts.isTaggedTemplateExpression)
		taggedNodes = taggedNodes.filter(node => PluginConfig.tags.includes(node.tag.getText()))

		return taggedNodes.map(node => this.createTemplate(node))
	}
}


/** 
 * If source file not changed, can keep template context in cache.
 * If source file not touched for 5 minutes, clear cache.
 */
class TemplateContextCache {

	private cache: WeakerPairKeysMap<TS.SourceFile, TS.TaggedTemplateExpression, Template> = new WeakerPairKeysMap()
	private cachedSize: WeakMap<TS.SourceFile, number> = new WeakMap()
	private timeouts: WeakMap<TS.SourceFile, NodeJS.Timeout> = new WeakMap()

	get(sourceFile: TS.SourceFile, taggedNode: TS.TaggedTemplateExpression): Template | undefined {
		if (!this.cache.hasKey(sourceFile)) {
			return undefined
		}

		this.resetTimeout(sourceFile)

		let tc = this.cache.get(sourceFile, taggedNode)
		if (!tc) {
			return undefined
		}

		// I believe there must be a better way to check document version!
		let oldSize = this.cachedSize.get(sourceFile)
		let newSize = sourceFile.getFullWidth()
		let changed = oldSize !== newSize

		if (changed) {
			this.clearSourceFile(sourceFile)

			return undefined
		}

		return tc
	}

	resetTimeout(sourceFile: TS.SourceFile) {
		let timeout = this.timeouts.get(sourceFile)
		if (timeout) {
			clearTimeout(timeout)
			timeout = setTimeout(() => this.clearSourceFile(sourceFile), 5 * 60 * 1000)
			this.timeouts.set(sourceFile, timeout)	
		}
	}

	private clearSourceFile(sourceFile: TS.SourceFile) {
		this.cache.deleteOf(sourceFile)
		this.cachedSize.delete(sourceFile)
		this.timeouts.delete(sourceFile)
	}

	add(sourceFile: TS.SourceFile, taggedNode: TS.TaggedTemplateExpression, context: Template) {
		this.cache.set(sourceFile, taggedNode, context)
		this.cachedSize.set(sourceFile, sourceFile.getFullWidth())
		this.resetTimeout(sourceFile)
	}
}
