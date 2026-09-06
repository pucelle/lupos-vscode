import {describe, expect, it, vi} from 'vitest'
import {WorkSpaceAnalyzer} from '../../packages/lupos-server/src/lupos-service/analyzer/analyzer'
import {createTestLanguageService} from './language-service'

const Source = `
import {html, Component} from 'lupos.html'
class Card extends Component {
	title = ''
}
const view = html\`<Card></Card>\`
`

describe('server language features', () => {
	it('reuses workspace analysis for repeated completion', () => {
		let source = Source.replace('<Card>', '<Ca>')
		let analyzerUpdate = vi.spyOn(WorkSpaceAnalyzer.prototype, 'update')
		let harness = createTestLanguageService(source)
		let position = source.indexOf('<Ca>') + 3

		harness.service.getCompletionsAtPosition(harness.fileName, position, {})
		harness.service.getCompletionsAtPosition(harness.fileName, position, {})

		expect(analyzerUpdate).toHaveBeenCalledTimes(1)

		let changedSource = source.replace('<Ca>', '<Car>')
		harness.update(changedSource)
		harness.service.getCompletionsAtPosition(
			harness.fileName,
			changedSource.indexOf('<Car>') + 4,
			{}
		)

		expect(analyzerUpdate).toHaveBeenCalledTimes(2)
		analyzerUpdate.mockRestore()
	})

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
