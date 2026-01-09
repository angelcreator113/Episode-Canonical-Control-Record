/**
 * Logger Service
 * Simple logging utility for the application
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

class Logger {
  constructor(name = 'App') {
    this.name = name;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  _formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const context = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    return `[${timestamp}] [${level}] [${this.name}] ${message} ${context}`;
  }

  info(message, data) {
    console.log(this._formatMessage('INFO', message, data));
  }

  warn(message, data) {
    console.warn(this._formatMessage('WARN', message, data));
  }

  error(message, data) {
    console.error(this._formatMessage('ERROR', message, data));
  }

  debug(message, data) {
    if (this.logLevel === 'DEBUG') {
      console.log(this._formatMessage('DEBUG', message, data));
    }
  }
}

module.exports = new Logger();
