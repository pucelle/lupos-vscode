import {describe, expect, it} from 'vitest'
import {createTestLanguageService} from './language-service'

const Source = `
import {html, Component} from 'lupos.html'
class Card extends Component {
	title = ''
}
const view = html\`<Card></Card>\`
`

describe('server language features', () => {
	it('completes workspace components inside a tag name', () => {
		let source = Source.replace('<Card>', '<Ca>')
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('<Ca>') + 3
		let completions = service.getCompletionsAtPosition(fileName, position, {})

		expect(completions?.entries.some(entry => entry.name === 'Card')).toBe(true)
	})

	it('returns quick info and a definition for a component tag', () => {
		let {service, fileName} = createTestLanguageService(Source)
		let position = Source.indexOf('<Card>') + 2
		let quickInfo = service.getQuickInfoAtPosition(fileName, position)
		let definition = service.getDefinitionAndBoundSpan(fileName, position)

		expect(quickInfo?.textSpan.length).toBe(4)
		expect(definition?.definitions?.[0].fileName).toBe(fileName)
		expect(definition?.definitions?.[0].textSpan.start).toBe(Source.indexOf('Card extends'))
	})
})
