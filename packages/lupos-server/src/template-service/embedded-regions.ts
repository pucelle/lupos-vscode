import {Template} from './template'
import {HTMLNodeType} from '../lupos-ts-module'
import {TemplateEmbeddedRegion} from './embedded-region'


/** 
 * Helps to parse all embedded html & css documents of a template.
 * Whole template will also be treated as an embedded document.
 */
export class TemplateEmbeddedRegions {
	
	readonly template: Template
	private regions: TemplateEmbeddedRegion[] = []

	constructor(template: Template) {
		this.template = template
		this.parseForRegions()
	}

	/** Parse for all embedded regions. */
	private parseForRegions() {
		this.template.root.visit(node => {
			if (node.type !== HTMLNodeType.Tag) {
				return
			}

			if (node.tagName === 'style') {
				this.regions.push(this.createRegion(
					'css',
					node.start,
					node.end,
					false
				))
			}

			for (let attr of node.attrs!) {
				if (attr.name === 'style' || attr.name === ':style') {
					let start = attr.valueStart
					let end = attr.valueEnd

					if (attr.quoted) {
						start += 1
						end -= 1
					}

					this.regions.push(this.createRegion(
						'css',
						start,
						end,
						true
					))
				}
			}
		})

		this.regions.push(this.createRegion(
			this.template.tagName === 'css' ? 'css' : 'html',
			0,
			this.template.content.length,
			false
		))
	}

	/** Can used to get css embedded document from a html`...`, will fill empty chars for non css part. */
	private createRegion(languageId: 'html' | 'css', start: number, end: number, innerStyle: boolean): TemplateEmbeddedRegion {
		let templateContent = this.template.content
		let content = templateContent.slice(start, end)
		let offset = 0

		if (innerStyle) {
			content = `_{${content}}`
			offset = -2
		}

		if (languageId === 'css') {

			// Get semantic diagnostics for second `$`.
			content = content.replace(/(\$LUPOS_SLOT_INDEX_\d+)\$/g, '$1_')
		}

		return new TemplateEmbeddedRegion(content, languageId, start, end, offset)
	}

	/** 
	 * Get document at position, may returns embedded CSS document.
	 * `offset` is the position within embedded document.
	 */
	getRegionAt(offset: number): TemplateEmbeddedRegion {
		for (let region of this.regions) {
			if (offset >= region.start) {
				if (offset <= region.end) {
					return region
				}
			}
			else {
				break
			}
		}

		// Returns whole template region.
		return this.regions[this.regions.length - 1]
	}

	/** Returns whole template region. */
	getWholeTemplateRegion() {
		return this.regions[this.regions.length - 1]
	}
}


