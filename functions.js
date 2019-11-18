/* eslint-disable no-empty */
/* eslint-disable no-multi-assign */
/* eslint-disable prefer-rest-params */
/* eslint-disable no-bitwise */
/* eslint-disable no-mixed-operators */
const db = require('./db');

const funcs = {
  send_reply(p, r, s) {
    let prepare = '';
    if (Array.isArray(p)) {
      prepare += p[0];
      const addr = p[1].split(':');
      prepare += funcs.inet_pton(addr[0]);
      prepare += funcs.pack('n*', addr[1]);
      prepare += p[2] ? p[2] : '';
    } else {
      prepare = p;
    }
    // eslint-disable-next-line no-buffer-constructor
    const reply = new Buffer(prepare, 'ascii');
    // (err, bytes) =>
    s.send(reply, 0, reply.length, r.port, r.address, (err) => {
      if (err) {
        console.error('Error sending OK buffer to client', err);
      }
    });
  },
  get_servers(a, callback) {
    let i = 0;
    switch (a) {
      case 'all':
        db.query('SELECT * FROM `ms_servers`', (err, rows) => {
          if (err) {
            return;
          }
          const r = [];
          for (i = 0; i < rows.length; i += 1) {
            r[r.length] = rows[i].addr;
          }
          console.log(`Обновление списка обычных серверов. Всего: ${rows.length}`);
          callback(null, r);
        });
        break;
      case 'boost':
        db.query('SELECT * FROM `ms_boost` ORDER BY `id` DESC', (err, rows) => {
          if (err) return;
          const r = [];
          for (i = 0; i < rows.length; i += 1) {
            r[r.length] = rows[i].addr;
          }
          console.log(`Обновление списка boost серверов. Всего: ${rows.length}`);
          callback(null, r);
        });
        break;
      default:
        console.log('not ok');
        break;
    }
  },
  inet_pton(a) {
    let m;
    const f = String.fromCharCode;
    m = a.match(/^(?:\d{1,3}(?:\.|$)){4}/);
    if (m) {
      m = m[0].split('.');
      m = f(m[0]) + f(m[1]) + f(m[2]) + f(m[3]);
      return m.length === 4 ? m : false;
    }
    return false;
  },
  pack(format) {
    let formatPointer = 0;
    let argumentPointer = 1;
    let result = '';
    let argument = '';
    let i = 0;
    let r = [];
    let instruction;
    let quantifier;
    let word;
    let precisionBits;
    let exponentBits;
    let extraNullCount;

    // vars used by float encoding
    let bias;
    let minExp;
    let maxExp;
    let minUnnormExp;
    let status;
    let exp;
    let len;
    let bin;
    let signal;
    let n;
    let intPart;
    let floatPart;
    let lastBit;
    let rounded;
    let j;
    let k;
    let tmpResult;

    while (formatPointer < format.length) {
      instruction = format.charAt(formatPointer);
      quantifier = '';
      formatPointer += 1;
      while (
        (formatPointer < format.length)
        // eslint-disable-next-line no-useless-escape
        && (format.charAt(formatPointer).match(/[\d\*]/) !== null)
      ) {
        quantifier += format.charAt(formatPointer);
        formatPointer += 1;
      }
      if (quantifier === '') {
        quantifier = '1';
      }

      // Now pack variables: 'quantifier' times 'instruction'
      switch (instruction) {
        case 'a':
        case 'A':
          // NUL-padded string
          // SPACE-padded string
          if (typeof arguments[argumentPointer] === 'undefined') {
            throw new Error(`Warning:  pack() Type ${instruction}: not enough arguments`);
          } else {
            argument = String(arguments[argumentPointer]);
          }
          if (quantifier === '*') {
            quantifier = argument.length;
          }
          // eslint-disable-next-line no-shadow
          for (i = 0; i < quantifier; i += 1) {
            if (typeof argument[i] === 'undefined') {
              if (instruction === 'a') {
                result += String.fromCharCode(0);
              } else {
                result += ' ';
              }
            } else {
              result += argument[i];
            }
          }
          argumentPointer += 1;
          break;
        case 'h':
        case 'H':
          // Hex string, low nibble first
          // Hex string, high nibble first
          if (typeof arguments[argumentPointer] === 'undefined') {
            throw new Error(`Warning: pack() Type ${instruction}: not enough arguments`);
          } else {
            argument = arguments[argumentPointer];
          }
          if (quantifier === '*') {
            quantifier = argument.length;
          }
          if (quantifier > argument.length) {
            const msg = `Warning: pack() Type ${instruction}: not enough characters in string`;
            throw new Error(msg);
          }

          // eslint-disable-next-line no-shadow
          for (i = 0; i < quantifier; i += 2) {
            // Always get per 2 bytes...
            word = argument[i];
            if (((i + 1) >= quantifier) || typeof argument[i + 1] === 'undefined') {
              word += '0';
            } else {
              word += argument[i + 1];
            }
            // The fastest way to reverse?
            if (instruction === 'h') {
              word = word[1] + word[0];
            }
            result += String.fromCharCode(parseInt(word, 16));
          }
          argumentPointer += 1;
          break;

        case 'c':
        case 'C':
          // signed char
          // unsigned char
          // c and C is the same in pack
          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning:  pack() Type ${instruction}: too few arguments`);
          }

          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(arguments[argumentPointer]);
            argumentPointer += 1;
          }
          break;
        case 's':
        case 'S':
        case 'v':
          // signed short (always 16 bit, machine byte order)
          // unsigned short (always 16 bit, machine byte order)
          // s and S is the same in pack
          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning:  pack() Type ${instruction}: too few arguments`);
          }

          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
            argumentPointer += 1;
          }
          break;
        case 'n':
          // unsigned short (always 16 bit, big endian byte order)
          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning: pack() Type ${instruction}: too few arguments`);
          }

          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
            argumentPointer += 1;
          }
          break;

        case 'i':
        case 'I':
        case 'l':
        case 'L':
        case 'V':
          // signed integer (machine dependent size and byte order)
          // unsigned integer (machine dependent size and byte order)
          // signed long (always 32 bit, machine byte order)
          // unsigned long (always 32 bit, machine byte order)
          // unsigned long (always 32 bit, little endian byte order)
          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning:  pack() Type ${instruction}: too few arguments`);
          }

          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF);
            argumentPointer += 1;
          }
          break;
        case 'N':
          // unsigned long (always 32 bit, big endian byte order)
          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning:  pack() Type ${instruction}: too few arguments`);
          }

          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
            result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
            argumentPointer += 1;
          }
          break;

        case 'f':
        case 'd':
          // float (machine dependent size and representation)
          // double (machine dependent size and representation)
          // version based on IEEE754
          precisionBits = 23;
          exponentBits = 8;
          if (instruction === 'd') {
            precisionBits = 52;
            exponentBits = 11;
          }

          if (quantifier === '*') {
            quantifier = arguments.length - argumentPointer;
          }
          if (quantifier > (arguments.length - argumentPointer)) {
            throw new Error(`Warning:  pack() Type ${instruction}: too few arguments`);
          }
          for (i = 0; i < quantifier; i += 1) {
            argument = arguments[argumentPointer];
            // bias = Math.pow(2, exponentBits - 1) - 1;
            bias = 2 ** (exponentBits - 1) - 1;
            minExp = -bias + 1;
            maxExp = bias;
            minUnnormExp = minExp - precisionBits;
            // eslint-disable-next-line no-cond-assign
            status = Number.isNaN(n = parseFloat(argument))
              || n === -Infinity
              || n === +Infinity ? n : 0;
            exp = 0;
            len = 2 * bias + 1 + precisionBits + 3;
            bin = new Array(len);
            signal = (n = status !== 0 ? 0 : n) < 0;
            n = Math.abs(n);
            intPart = Math.floor(n);
            floatPart = n - intPart;

            for (k = len; k;) {
              k -= 1;
              bin[k] = 0;
            }
            for (k = bias + 2; intPart && k;) {
              k -= 1;
              bin[k] = intPart % 2;
              intPart = Math.floor(intPart / 2);
            }
            // eslint-disable-next-line no-plusplus
            for (k = bias + 1; floatPart > 0 && k; --floatPart) {
              k += 1;
              (bin[k] = ((floatPart *= 2) >= 1) - 0);
            }
            // eslint-disable-next-line no-plusplus
            for (k = -1; ++k < len && !bin[k];) {}

            // @todo: Make this more readable:
            const key = (lastBit = precisionBits - 1
              // eslint-disable-next-line no-cond-assign
              + (k = (exp = bias + 1 - k) >= minExp
                && exp <= maxExp ? k + 1 : bias + 1 - (exp = minExp - 1))) + 1;

            if (bin[key]) {
              // eslint-disable-next-line no-cond-assign
              if (!(rounded = bin[lastBit])) {
                // eslint-disable-next-line no-plusplus
                for (j = lastBit + 2; !rounded && j < len; rounded = bin[j++]) {}
              }
              // eslint-disable-next-line no-plusplus
              for (j = lastBit + 1; rounded && --j >= 0;
                (bin[j] = !bin[j] - 0) && (rounded = 0)) {}
            }

            // eslint-disable-next-line no-plusplus
            for (k = k - 2 < 0 ? -1 : k - 3; ++k < len && !bin[k];) {}

            // eslint-disable-next-line no-cond-assign
            if ((exp = bias + 1 - k) >= minExp && exp <= maxExp) {
              k -= 1;
            } else if (exp < minExp) {
              if (exp !== bias + 1 - len && exp < minUnnormExp) {
                // "encodeFloat::float underflow"
              }
              k = bias + 1 - (exp = minExp - 1);
            }

            if (intPart || status !== 0) {
              exp = maxExp + 1;
              k = bias + 2;
              if (status === -Infinity) {
                signal = 1;
              } else if (Number.isNaN(status)) {
                bin[k] = 1;
              }
            }

            n = Math.abs(exp + bias);
            tmpResult = '';

            // eslint-disable-next-line no-plusplus
            for (j = exponentBits + 1; --j;) {
              tmpResult = (n % 2) + tmpResult;
              n = n >>= 1;
            }

            n = 0;
            j = 0;
            k = (tmpResult = (signal ? '1' : '0') + tmpResult + (bin
              .slice(k, k + precisionBits)
              .join(''))).length;
            r = [];

            for (; k;) {
              k -= 1;
              n += (1 << j) * tmpResult.charAt(k);
              if (j === 7) {
                r[r.length] = String.fromCharCode(n);
                n = 0;
              }
              j = (j + 1) % 8;
            }

            r[r.length] = n ? String.fromCharCode(n) : '';
            result += r.join('');
            argumentPointer += 1;
          }
          break;

        case 'x':
          // NUL byte
          if (quantifier === '*') {
            throw new Error('Warning: pack(): Type x: \'*\' ignored');
          }
          for (i = 0; i < quantifier; i += 1) {
            result += String.fromCharCode(0);
          }
          break;

        case 'X':
          // Back up one byte
          if (quantifier === '*') {
            throw new Error('Warning: pack(): Type X: \'*\' ignored');
          }
          for (i = 0; i < quantifier; i += 1) {
            if (result.length === 0) {
              throw new Error('Warning: pack(): Type X: outside of string');
            } else {
              result = result.substring(0, result.length - 1);
            }
          }
          break;

        case '@':
          // NUL-fill to absolute position
          if (quantifier === '*') {
            throw new Error('Warning: pack(): Type X: \'*\' ignored');
          }
          if (quantifier > result.length) {
            extraNullCount = quantifier - result.length;
            for (i = 0; i < extraNullCount; i += 1) {
              result += String.fromCharCode(0);
            }
          }
          if (quantifier < result.length) {
            result = result.substring(0, quantifier);
          }
          break;

        default:
          throw new Error(`Warning: pack() Type ${instruction}: unknown format code`);
      }
    }
    if (argumentPointer < arguments.length) {
      const msg2 = `Warning: pack(): ${arguments.length - argumentPointer} arguments unused`;
      throw new Error(msg2);
    }

    return result;
  },
  an(f) {
    return () => {
      f.apply(f, arguments);
      return f;
    };
  },
};

module.exports = funcs;
