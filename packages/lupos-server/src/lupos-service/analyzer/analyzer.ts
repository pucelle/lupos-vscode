import type * as TS from 'typescript'
import {Logger, ProjectContext} from '../../core'
import {Analyzer, LuposBinding, LuposComponent, LuposEvent, LuposProperty, TemplatePart, TemplatePartType} from '../../lupos-ts-module'
import {makeStartsMatchExp} from '../utils'
import {ExportsAnalyzer, ImportPathAndTextChange} from './exports'
import {Template} from '../../template-service'


export class WorkSpaceAnalyzer extends Analyzer {

	readonly context: ProjectContext
	readonly exports: ExportsAnalyzer

	constructor(context: ProjectContext) {
		super(context.helper)
		this.context = context
		this.exports = new ExportsAnalyzer(this.workspaceComponentsByFile, this.workSpaceBindingsByFile, this.context)
	}

	/** Make parsed results in given file expire. */
	protected deleteFile(file: TS.SourceFile) {
		super.deleteFile(file)
		this.exports.delete(file)
	}

	/** 
	 * Update to make sure reloading changed source files.
	 * Update for at most once within a micro task.
	 */
	update() {
		let changedFiles = this.compareFiles()

		for (let file of changedFiles) {
			this.analyzeFile(file)
		}

		if (changedFiles.size > 0) {
			Logger.log(`Analyzed ${changedFiles.size} files, now have ${[...this.components].length} components, ${[...this.bindings].length} bindings.`)
		}
	}

	/** Compare files, returned changed or not analyzed files, always exclude `lib.???.d.ts`. */
	private compareFiles() {

		// Exclude typescript lib files.
		let allFiles = new Set(
			this.context.program.getSourceFiles()
				.filter(file => !this.context.helper.symbol.isOfTypescriptLib(file))
		)

		// Not analyzed, or changed, or has referenced changed.
		let changedFiles: Set<TS.SourceFile> = new Set()

		// Delete files.
		for (let file of [...this.files.keys()]) {
			if (!allFiles.has(file)) {
				this.deleteFile(file)
				this.files.delete(file)
			}
		}

		for (let file of allFiles) {

			// Changed file will build a new source file.
			if (this.files.has(file)) {
				continue
			}

			changedFiles.add(file)

			// Also mark all files reference it as changed.
			let refFromFilePaths = this.references.getByRight(file.fileName)
			if (refFromFilePaths) {
				for (let refFromFile of refFromFilePaths) {
					changedFiles.add(refFromFile)
				}
			}
		}

		return changedFiles
	}

	/** 
	 * Get components that name starts with label.
	 * label` can be empty, then will return all components.
	 */
	getComponentsForCompletion(label: string): LuposComponent[] {
		let components: LuposComponent[] = []
		let re = makeStartsMatchExp(label)

		for (let component of this.components) {
			if (re.test(component.name)) {
				components.push(component)
			}
		}

		return components
	}

	/** 
	 * Get properties for component, and name starts with label.
	 * `label` can be empty, then will return all properties.
	 */
	getComponentPropertiesForCompletion(component: LuposComponent, label: string, mustBePublic: boolean = true): LuposProperty[] {
		let properties: Map<string, LuposProperty> = new Map()
		let re = makeStartsMatchExp(label)

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com.properties)) {
				if (mustBePublic && !property.public) {
					continue
				}

				if (properties.has(property.name)) {
					continue
				}
				
				if (re.test(property.name)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	/** 
	 * Get all refs or slots properties outer class declaration contains given node.
	 * `label` can be empty, then will return all properties.
	 */
	getSubPropertiesForCompletion(component: LuposComponent, propertyName: 'slotElements', subPropertyNameLabel: string): LuposProperty[] {
		let properties: Map<string, LuposProperty> = new Map()
		let re = makeStartsMatchExp(subPropertyNameLabel)

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com[propertyName])) {
				if (re.test(property.name) && !properties.has(property.name)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	
	/** 
	 * Get events for component, and name starts with label.
	 * `label` can be empty, then will return all events.
	 */
	getComponentEventsForCompletion(component: LuposComponent, label: string): LuposEvent[] {
		let events: Map<string, LuposEvent> = new Map()
		let re = makeStartsMatchExp(label)

		for (let com of this.walkComponents(component)) {
			for (let event of Object.values(com.events)) {
				if (events.has(event.name)) {
					continue
				}

				if (re.test(event.name)) {
					events.set(event.name, event)
				}
			}
		}

		return [...events.values()]
	}


	/** 
	 * Get bindings that name starts with label.
	 * label` can be empty, then will return all bindings.
	 */
	getBindingsForCompletion(label: string): LuposBinding[] {
		let bindings: LuposBinding[] = []
		let re = makeStartsMatchExp(label)

		for (let binding of this.bindings) {
			if (re.test(binding.name)) {
				bindings.push(binding)
			}
		}

		return bindings
	}

	/** 
	 * Get source file of part, which declared specified named component or binding.
	 * No need to import target component or binding.
	 */
	getPartSourceFile(part: TemplatePart, name: string): TS.SourceFile | undefined {
		let sourceFile: TS.SourceFile | undefined

		if (part.type === TemplatePartType.Component || part.type === TemplatePartType.EmptyStartTag) {
			let component = this.getComponentsForCompletion(name)?.find(c => c.name === name)
			sourceFile = component?.sourceFile
		}
		else if (part.type === TemplatePartType.Binding) {
			let binding = this.getBindingsForCompletion(name)?.find(c => c.name === name)
			sourceFile = binding?.sourceFile
		}

		return sourceFile
	}

	/** Resolve for import path, normally for each completion item. */
	resolveImportPathAndTextChange(part: TemplatePart, template: Template, name: string): ImportPathAndTextChange | undefined {
		let sourceFile = this.getPartSourceFile(part, name)
		if (!sourceFile) {
			return undefined
		}

		let pathChange = this.exports.getImportPathAndTextChange(name, sourceFile, template.sourceFile)
		return pathChange
	}

	/** Resolve for import path, normally for each completion item. */
	resolvePartImportPath(part: TemplatePart, template: Template, name: string): string | undefined {
		let sourceFile = this.getPartSourceFile(part, name)
		if (!sourceFile) {
			return undefined
		}

		let importPath = this.exports.getBestImportPath(name, sourceFile, template.sourceFile)
		return importPath
	}
}