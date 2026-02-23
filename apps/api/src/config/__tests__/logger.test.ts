/**
 * TC-7: Verify logger.info() produces JSON output with level, time, msg.
 * TC-8: Verify LOG_LEVEL filtering (debug shows, warn suppresses info).
 */

import pino from 'pino';

describe('logger', () => {
    function createTestLogger(level: string): { logger: pino.Logger; output: string[] } {
        const output: string[] = [];
        const stream = {
            write(msg: string) {
                output.push(msg);
            },
        };

        const logger = pino({ level }, stream);
        return { logger, output };
    }

    it('TC-7: info() produces JSON with level, time, and msg fields', () => {
        const { logger, output } = createTestLogger('info');

        logger.info({ msg: 'test' });

        expect(output).toHaveLength(1);
        const parsed = JSON.parse(output[0]!);
        expect(parsed).toHaveProperty('level', 30); // pino info = 30
        expect(parsed).toHaveProperty('time');
        expect(parsed).toHaveProperty('msg', 'test');
        expect(typeof parsed.time).toBe('number');
    });

    it('TC-7: structured data is included in JSON output', () => {
        const { logger, output } = createTestLogger('info');

        logger.info({ requestId: 'abc-123', duration: 42 }, 'request completed');

        const parsed = JSON.parse(output[0]!);
        expect(parsed.requestId).toBe('abc-123');
        expect(parsed.duration).toBe(42);
        expect(parsed.msg).toBe('request completed');
    });

    it('TC-8: LOG_LEVEL=debug includes debug messages', () => {
        const { logger, output } = createTestLogger('debug');

        logger.debug('debug message');
        logger.info('info message');

        expect(output).toHaveLength(2);
        expect(JSON.parse(output[0]!).msg).toBe('debug message');
        expect(JSON.parse(output[1]!).msg).toBe('info message');
    });

    it('TC-8: LOG_LEVEL=warn suppresses info and debug messages', () => {
        const { logger, output } = createTestLogger('warn');

        logger.debug('should not appear');
        logger.info('should not appear');
        logger.warn('should appear');

        expect(output).toHaveLength(1);
        expect(JSON.parse(output[0]!).msg).toBe('should appear');
    });
});
