/**
 * Interactive prompt configurations for Squoosh CLI
 * Uses inquirer for user input
 */

import inquirer from 'inquirer';
import { getAllEncoders, type CodecInfo } from '../codecs/index.js';
import { getSupportedExtensions } from '../codecs/decoders/index.js';

/**
 * Input selection from the user
 */
export interface InputSelection {
  /** Type of input: single file, multiple files, or folder */
  inputType: 'file' | 'files' | 'folder';
  /** Array of file or folder paths */
  paths: string[];
  /** Whether to search recursively in folders */
  recursive?: boolean;
  /** File extensions to include when scanning folders */
  extensions?: string[];
}

/**
 * Format selection from the user
 */
export interface FormatSelection {
  /** Internal format name */
  format: string;
  /** Full codec info */
  encoder: CodecInfo;
}

/**
 * Quality and encoding options
 */
export interface QualityOptions {
  /** Quality level (0-100) */
  quality: number;
}

/**
 * Prompt user to select input type and paths
 */
export async function promptInputType(): Promise<InputSelection> {
  const { inputType } = await inquirer.prompt<{ inputType: 'file' | 'files' | 'folder' }>([
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
    const { filePath } = await inquirer.prompt<{ filePath: string }>([
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter the path to the image file:',
        validate: (input: string) => {
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
    const { filePaths } = await inquirer.prompt<{ filePaths: string }>([
      {
        type: 'input',
        name: 'filePaths',
        message: 'Enter the paths to the image files (comma-separated):',
        validate: (input: string) => {
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
  const { folderPath } = await inquirer.prompt<{ folderPath: string }>([
    {
      type: 'input',
      name: 'folderPath',
      message: 'Enter the path to the folder:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Please enter a folder path';
        }
        return true;
      },
    },
  ]);

  const { recursive } = await inquirer.prompt<{ recursive: boolean }>([
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
  const extensionResult = await (inquirer.prompt as unknown as (questions: unknown) => Promise<{ extensions: string[] }>)([
    {
      type: 'checkbox',
      name: 'extensions',
      message: 'Which file types should be included?',
      choices: extensionChoices,
      validate: (input: string[]) => {
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
export async function promptFormat(): Promise<FormatSelection> {
  const encoders = getAllEncoders();
  const choices = encoders.map((encoder) => ({
    name: `${encoder.label} (.${encoder.extension})`,
    value: encoder.name,
  }));

  const { format } = await inquirer.prompt<{ format: string }>([
    {
      type: 'list',
      name: 'format',
      message: 'Select output format:',
      choices,
    },
  ]);

  const encoder = encoders.find((e) => e.name === format)!;
  return { format, encoder };
}

/**
 * Prompt user for quality settings
 */
export async function promptQuality(encoder: CodecInfo): Promise<QualityOptions> {
  // Get the default quality from the encoder if it exists
  const defaultQuality =
    typeof (encoder.defaultOptions as { quality?: number })?.quality === 'number'
      ? (encoder.defaultOptions as { quality: number }).quality
      : 75;

  const { quality } = await inquirer.prompt<{ quality: string }>([
    {
      type: 'input',
      name: 'quality',
      message: `Enter quality level (0-100) for ${encoder.label}:`,
      default: defaultQuality.toString(),
      validate: (input: string) => {
        const num = Number(input);
        if (Number.isNaN(num) || num < 0 || num > 100) {
          return 'Please enter a number between 0 and 100';
        }
        return true;
      },
    },
  ]);

  return { quality: Number(quality) };
}

/**
 * Prompt user for output directory
 */
export async function promptOutputDir(defaultDir: string): Promise<string> {
  const { useDefault } = await inquirer.prompt<{ useDefault: boolean }>([
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

  const { outputDir } = await inquirer.prompt<{ outputDir: string }>([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Enter the output directory path:',
      default: defaultDir,
      validate: (input: string) => {
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
export async function confirmSettings(settings: {
  input: InputSelection;
  format: FormatSelection;
  quality: QualityOptions;
  outputDir: string;
  fileCount: number;
}): Promise<boolean> {
  console.log('\n  --- Settings Summary ---\n');
  console.log(`  Input type:      ${settings.input.inputType}`);
  console.log(`  Files to process: ${settings.fileCount}`);
  console.log(`  Output format:   ${settings.format.encoder.label} (.${settings.format.encoder.extension})`);
  console.log(`  Quality:         ${settings.quality.quality}`);
  console.log(`  Output directory: ${settings.outputDir}`);
  console.log('');

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with these settings?',
      default: true,
    },
  ]);

  return confirmed;
}
