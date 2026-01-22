/**
 * Interactive prompt configurations for Squoosh CLI
 * Uses inquirer for user input
 */
import inquirer from 'inquirer';
import { getAllEncoders } from '../codecs/index.js';
import { getSupportedExtensions } from '../codecs/decoders/index.js';
/**
 * Prompt user to select input type and paths
 */
export async function promptInputType() {
    const { inputType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'inputType',
            message: 'What would you like to compress?',
            choices: [
                { name: 'A single file', value: 'file' },
                { name: 'Multiple files', value: 'files' },
                { name: 'All images in a folder', value: 'folder' },
            ],
        },
    ]);
    if (inputType === 'file') {
        const { filePath } = await inquirer.prompt([
            {
                type: 'input',
                name: 'filePath',
                message: 'Enter the path to the image file:',
                validate: (input) => {
                    if (!input.trim()) {
                        return 'Please enter a file path';
                    }
                    return true;
                },
            },
        ]);
        return {
            inputType: 'file',
            paths: [filePath.trim()],
        };
    }
    if (inputType === 'files') {
        const { filePaths } = await inquirer.prompt([
            {
                type: 'input',
                name: 'filePaths',
                message: 'Enter the paths to the image files (comma-separated):',
                validate: (input) => {
                    if (!input.trim()) {
                        return 'Please enter at least one file path';
                    }
                    return true;
                },
            },
        ]);
        const paths = filePaths.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
        return {
            inputType: 'files',
            paths,
        };
    }
    // Folder input
    const { folderPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'folderPath',
            message: 'Enter the path to the folder:',
            validate: (input) => {
                if (!input.trim()) {
                    return 'Please enter a folder path';
                }
                return true;
            },
        },
    ]);
    const { recursive } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'recursive',
            message: 'Search subfolders recursively?',
            default: false,
        },
    ]);
    const supportedExtensions = getSupportedExtensions();
    const extensionChoices = supportedExtensions.map((ext) => ({
        name: ext,
        value: ext,
        checked: true,
    }));
    // Use type assertion to handle inquirer's complex checkbox types
    const extensionResult = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'extensions',
            message: 'Which file types should be included?',
            choices: extensionChoices,
            validate: (input) => {
                if (input.length === 0) {
                    return 'Please select at least one file type';
                }
                return true;
            },
        },
    ]);
    const { extensions } = extensionResult;
    return {
        inputType: 'folder',
        paths: [folderPath.trim()],
        recursive,
        extensions,
    };
}
/**
 * Prompt user to select output format
 */
export async function promptFormat() {
    const encoders = getAllEncoders();
    const choices = encoders.map((encoder) => ({
        name: `${encoder.label} (.${encoder.extension})`,
        value: encoder.name,
    }));
    const { format } = await inquirer.prompt([
        {
            type: 'list',
            name: 'format',
            message: 'Select output format:',
            choices,
        },
    ]);
    const encoder = encoders.find((e) => e.name === format);
    return { format, encoder };
}
/**
 * Prompt user for quality settings
 */
export async function promptQuality(encoder) {
    // Get the default quality from the encoder if it exists
    const defaultQuality = typeof encoder.defaultOptions?.quality === 'number'
        ? encoder.defaultOptions.quality
        : 75;
    const { quality } = await inquirer.prompt([
        {
            type: 'number',
            name: 'quality',
            message: `Enter quality level (0-100) for ${encoder.label}:`,
            default: defaultQuality,
            validate: (input) => {
                if (isNaN(input) || input < 0 || input > 100) {
                    return 'Please enter a number between 0 and 100';
                }
                return true;
            },
        },
    ]);
    return { quality };
}
/**
 * Prompt user for output directory
 */
export async function promptOutputDir(defaultDir) {
    const { useDefault } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useDefault',
            message: `Save output files in the same directory as input files?`,
            default: true,
        },
    ]);
    if (useDefault) {
        return defaultDir;
    }
    const { outputDir } = await inquirer.prompt([
        {
            type: 'input',
            name: 'outputDir',
            message: 'Enter the output directory path:',
            default: defaultDir,
            validate: (input) => {
                if (!input.trim()) {
                    return 'Please enter a directory path';
                }
                return true;
            },
        },
    ]);
    return outputDir.trim();
}
/**
 * Confirm settings before processing
 */
export async function confirmSettings(settings) {
    console.log('\n  --- Settings Summary ---\n');
    console.log(`  Input type:      ${settings.input.inputType}`);
    console.log(`  Files to process: ${settings.fileCount}`);
    console.log(`  Output format:   ${settings.format.encoder.label} (.${settings.format.encoder.extension})`);
    console.log(`  Quality:         ${settings.quality.quality}`);
    console.log(`  Output directory: ${settings.outputDir}`);
    console.log('');
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: 'Proceed with these settings?',
            default: true,
        },
    ]);
    return confirmed;
}
