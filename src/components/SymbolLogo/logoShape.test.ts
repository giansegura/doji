import { expect, test } from 'vitest'
import { LOGO_SAMPLE, type PixelAt, type Rgba, shapeOf } from './logoShape'

const LAST = LOGO_SAMPLE - 1
const DARK: Rgba = [26, 30, 33, 255]
const PALE: Rgba = [240, 243, 250, 255]
const WHITE: Rgba = [255, 255, 255, 255]
const BLACK: Rgba = [0, 0, 0, 255]
const RED: Rgba = [220, 0, 1, 235]
const CLEAR: Rgba = [0, 0, 0, 0]

const solid = (color: Rgba): PixelAt => () => color

const isInCorner = (x: number, y: number): boolean => (x < 3 || x > LAST - 3) && (y < 3 || y > LAST - 3)

const isInMiddle = (x: number, y: number): boolean => x >= 8 && x < 24 && y >= 8 && y < 24

const roundedTile = (color: Rgba): PixelAt => (x, y) => (isInCorner(x, y) ? CLEAR : color)

const inkOn = (background: Rgba, ink: Rgba): PixelAt => (x, y) => (isInMiddle(x, y) ? ink : background)

const ring = (ink: Rgba): PixelAt => (x, y) => {
  const distance = Math.hypot(x - LAST / 2, y - LAST / 2)
  return distance > 11 && distance < 16.5 ? ink : CLEAR
}

test('Should take a square of a brand colour as a tile', () => {
  expect(shapeOf(solid(DARK))).toBe('tile')
  expect(shapeOf(inkOn(DARK, WHITE))).toBe('tile')
})

test('Should take a square of a pale colour as a tile', () => {
  expect(shapeOf(inkOn(PALE, RED))).toBe('tile')
})

test('Should take a rounded tile, clear only at its corners, as a tile', () => {
  expect(shapeOf(roundedTile(RED))).toBe('tile')
})

test('Should take a logo on plain white as a loose mark', () => {
  expect(shapeOf(inkOn(WHITE, BLACK))).toBe('mark')
  expect(shapeOf(inkOn([252, 251, 250, 255], BLACK))).toBe('mark')
})

test('Should take a logo on a clear background as a loose mark', () => {
  expect(shapeOf(inkOn(CLEAR, RED))).toBe('mark')
})

test('Should take a logo that touches its four edges but not its corners as a loose mark', () => {
  expect(shapeOf(ring(RED))).toBe('mark')
})

test('Should take a white logo on a clear background as a pale mark', () => {
  expect(shapeOf(inkOn(CLEAR, WHITE))).toBe('pale')
  expect(shapeOf(inkOn(CLEAR, [236, 238, 240, 255]))).toBe('pale')
})

test('Should take a logo that is only partly white as an ordinary mark', () => {
  const half: PixelAt = (x, y) => (isInMiddle(x, y) ? (x < 16 ? WHITE : RED) : CLEAR)
  expect(shapeOf(half)).toBe('mark')
})

test('Should take an empty image as an ordinary mark', () => {
  expect(shapeOf(solid(CLEAR))).toBe('mark')
})
