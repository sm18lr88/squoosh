#!/usr/bin/env node
/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Must import ImageData polyfill first!
import './utils/image-data.js';
import { program } from 'commander';
import chalk from 'chalk';
import { runInteractive } from './interactive/index.js';
import { runCompress } from './batch/index.js';
import { listEncoders, getAllEncoders } from './codecs/index.js';
import { startServer } from './server/index.js';
// Display banner
console.log(chalk.bold.cyan('\n  Squoosh CLI\n'));
program
    .name('squoosh')
    .description('Image compression CLI powered by Squoosh')
    .version('2.0.0');
// Interactive command
program
    .command('interactive')
    .alias('i')
    .description('Run in interactive mode with guided prompts')
    .action(async () => {
    try {
        await runInteractive();
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Compress command (main command)
program
    .command('compress <input>')
    .description('Compress image(s) to specified format')
    .option('-f, --format <format>', `Output format (${listEncoders().join('|')})`, 'mozjpeg')
    .option('-q, --quality <number>', 'Quality (0-100)', '75')
    .option('-o, --output <dir>', 'Output directory (default: same as input)')
    .option('-r, --recursive', 'Process directories recursively', false)
    .option('--ext <extensions>', 'File extensions to process (comma-separated)', 'jpg,jpeg,png,webp,avif')
    .option('--suffix <suffix>', 'Add suffix to output filename (e.g., "-compressed")')
    .option('--resize <WxH>', 'Resize to width x height (e.g., 800x600)')
    .option('--parallel <n>', 'Number of parallel workers (auto-detected if not specified)')
    .option('--continue-on-error', 'Continue processing on error', false)
    .option('--replace', 'Delete original files after successful compression', false)
    .option('--no-fast', 'Disable fast native backends, use WASM only')
    .action(async (input, options) => {
    try {
        const compressOptions = {
            format: options.format,
            quality: options.quality,
            output: options.output,
            recursive: options.recursive,
            ext: options.ext,
            suffix: options.suffix,
            resize: options.resize,
            parallel: options.parallel || '',
            continueOnError: options.continueOnError,
            replace: options.replace,
            fast: options.fast, // --no-fast sets this to false
        };
        await runCompress(input, compressOptions);
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// List formats command
program
    .command('formats')
    .description('List available output formats')
    .action(() => {
    console.log(chalk.bold('Available output formats:\n'));
    const encoders = getAllEncoders();
    const maxNameLen = Math.max(...encoders.map((e) => e.name.length));
    const maxLabelLen = Math.max(...encoders.map((e) => e.label.length));
    for (const encoder of encoders) {
        const name = encoder.name.padEnd(maxNameLen);
        const label = encoder.label.padEnd(maxLabelLen);
        const ext = `.${encoder.extension}`;
        console.log(`  ${chalk.cyan(name)}  ${chalk.gray(label)}  ${chalk.yellow(ext)}`);
    }
    console.log(chalk.gray(`\nUse with: squoosh compress <input> -f <format>\n`));
});
// Serve command - starts Sharp server for web app acceleration
program
    .command('serve')
    .description('Start local Sharp server for web app acceleration')
    .option('-p, --port <number>', 'Server port', '7331')
    .option('--allow-dir <dirs>', 'Comma-separated list of allowed directories for file access')
    .action(async (options) => {
    try {
        const port = parseInt(options.port, 10);
        const allowedDirs = options.allowDir
            ? options.allowDir.split(',').map((d) => d.trim())
            : [];
        await startServer({ port, allowedDirs });
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Default action when no command specified
program.action(() => {
    program.outputHelp();
});
program.parse();
