import { escapeRegex } from './regex'

describe('escapeRegex', () => {
  describe('special characters', () => {
    it('should escape dot', () => {
      expect(escapeRegex('.')).toBe('\\.')
    })

    it('should escape asterisk', () => {
      expect(escapeRegex('*')).toBe('\\*')
    })

    it('should escape plus', () => {
      expect(escapeRegex('+')).toBe('\\+')
    })

    it('should escape question mark', () => {
      expect(escapeRegex('?')).toBe('\\?')
    })

    it('should escape caret', () => {
      expect(escapeRegex('^')).toBe('\\^')
    })

    it('should escape dollar sign', () => {
      expect(escapeRegex('$')).toBe('\\$')
    })

    it('should escape square brackets', () => {
      expect(escapeRegex('[]')).toBe('\\[\\]')
    })

    it('should escape curly braces', () => {
      expect(escapeRegex('{}')).toBe('\\{\\}')
    })

    it('should escape parentheses', () => {
      expect(escapeRegex('()')).toBe('\\(\\)')
    })

    it('should escape pipe', () => {
      expect(escapeRegex('|')).toBe('\\|')
    })

    it('should escape forward slash', () => {
      expect(escapeRegex('/')).toBe('\\/')
    })

    it('should escape backslash', () => {
      expect(escapeRegex('\\')).toBe('\\\\')
    })

    it('should escape hyphen', () => {
      expect(escapeRegex('-')).toBe('\\-')
    })
  })

  describe('combinations', () => {
    it('should escape multiple special characters', () => {
      expect(escapeRegex('.*+')).toBe('\\.\\*\\+')
      expect(escapeRegex('[0-9]+')).toBe('\\[0\\-9\\]\\+')
      expect(escapeRegex('(foo|bar)')).toBe('\\(foo\\|bar\\)')
    })

    it('should handle mixed regular and special characters', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world')
      expect(escapeRegex('user@example.com')).toBe('user@example\\.com')
      expect(escapeRegex('price: $10.99')).toBe('price: \\$10\\.99')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(escapeRegex('')).toBe('')
    })

    it('should handle string with no special characters', () => {
      expect(escapeRegex('hello')).toBe('hello')
      expect(escapeRegex('123')).toBe('123')
    })

    it('should handle whitespace', () => {
      expect(escapeRegex(' ')).toBe(' ')
      expect(escapeRegex('\t')).toBe('\t')
      expect(escapeRegex('\n')).toBe('\n')
    })

    it('should handle unicode characters', () => {
      expect(escapeRegex('😊')).toBe('😊')
      expect(escapeRegex('→')).toBe('→')
    })
  })

  describe('practical usage', () => {
    it('should create valid regex patterns', () => {
      const pattern = new RegExp(escapeRegex('hello-world'))
      expect(pattern.test('hello-world')).toBe(true)
      expect(pattern.test('helloaworld')).toBe(false)
    })

    it('should work with email-like patterns', () => {
      const pattern = new RegExp(escapeRegex('user.name@example.com'))
      expect(pattern.test('user.name@example.com')).toBe(true)
      expect(pattern.test('username@example.com')).toBe(false)
    })

    it('should work with file paths', () => {
      const pattern = new RegExp(escapeRegex('C:\\Program Files\\App'))
      expect(pattern.test('C:\\Program Files\\App')).toBe(true)
      expect(pattern.test('C:/Program Files/App')).toBe(false)
    })
  })
})
