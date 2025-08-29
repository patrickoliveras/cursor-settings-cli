#!/usr/bin/env node
'use strict';

import { runExtract as cmdExtract, printHelp as helpExtract } from '../commands/extract';
import { runCompare as cmdCompare, printHelp as helpCompare } from '../commands/compare';
import { runReplace as cmdReplace, printHelp as helpReplace } from '../commands/replace';

function printRootHelp(): void {
  console.log(`Usage: cursor-settings <command> [options]

Commands:
  extract   Read settings JSON from the DB and print or save it
  compare   Diff DB JSON against a reference JSON file
  replace   Safely back up and replace settings JSON in the DB

Run 'cursor-settings <command> --help' for command-specific options.
`);
}

(async () => {
  try {
    const [, , cmd, ...rest] = process.argv;
    switch ((cmd || '').toLowerCase()) {
      case 'extract':
        await cmdExtract(rest);
        break;
      case 'compare':
        await cmdCompare(rest);
        break;
      case 'replace':
        await cmdReplace(rest);
        break;
      case '-h':
      case '--help':
      case 'help':
      case '':
        printRootHelp();
        process.exit(0);
      default:
        console.error(`Unknown command: ${cmd}`);
        printRootHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
})();
