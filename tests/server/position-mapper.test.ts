import {describe, expect, it} from 'vitest'
import {PositionMapper} from '../../packages/lupos-server/src/lupos-ts-module/utils/position-mapper'

describe('PositionMapper', () => {
	it('maps plain ranges and interpolations in both directions', () => {
		let mapper = new PositionMapper()
		mapper.add(0, 10)
		mapper.add(5, 15)
		mapper.add(10, 30)

		expect(mapper.map(2)).toBe(12)
		expect(mapper.map(7)).toBe(21)
		expect(mapper.backMap(21)).toBe(7)
		expect(mapper.mapInOrder(11)).toBe(31)
	})

	it('is an identity mapper without anchors', () => {
		let mapper = new PositionMapper()
		expect(mapper.map(12)).toBe(12)
		expect(mapper.backMap(12)).toBe(12)
	})
})
