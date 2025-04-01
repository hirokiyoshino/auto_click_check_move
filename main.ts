/// <reference types="https://deno.land/x/deno/runtime/types.d.ts" />
// Note: If you still see errors related to the 'Deno' namespace,
// please ensure the VS Code Deno extension is enabled and configured correctly for this workspace.
// You might need to run "Deno: Initialize Workspace Configuration" from the command palette.

// --- Settings ---
const INTERVAL_MS = 100; // Click interval in milliseconds
const TOLERANCE = 10; // Allowed mouse movement tolerance in pixels
// --- End Settings ---

interface Point {
  x: number;
  y: number;
}

/**
 * Custom error class for cliclick related errors.
 */
class CliclickError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "CliclickError";
  }
}

/**
 * Runs the cliclick command with the given arguments.
 * Throws a CliclickError if the command fails or is not found.
 * @param args Arguments to pass to cliclick.
 * @returns The trimmed stdout output of the command.
 */
async function runCliclick(args: string[]): Promise<string> {
  try {
    const command = new Deno.Command("cliclick", {
      args: args,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr).trim();
      let errorMessage = `cliclick command failed with code ${code}: ${errorOutput}`;
      if (errorOutput.includes("permission")) {
        errorMessage = "Cliclick permission denied. Check System Settings > Privacy & Security > Accessibility.";
      }
      throw new CliclickError(errorMessage);
    }
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new CliclickError(
        "Command 'cliclick' not found. Please install it (e.g., `brew install cliclick`) and ensure it's in your PATH.",
        error,
      );
    } else if (error instanceof CliclickError) {
        throw error; // Re-throw CliclickError directly
    } else {
      // Wrap other unexpected errors
      throw new CliclickError(
        `An unexpected error occurred while running cliclick: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }
}

/**
 * Gets the current mouse coordinates using cliclick.
 * Throws a CliclickError if coordinates cannot be obtained or parsed.
 * @returns A Point object with x, y coordinates.
 */
async function getCurrentCoords(): Promise<Point> {
  const output = await runCliclick(["p:."]); // "p:." returns "x,y"
  const parts = output.split(",");
  if (parts.length === 2) {
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (!isNaN(x) && !isNaN(y)) {
      return { x, y };
    }
  }
  // Throw error if format is unexpected
  throw new CliclickError(`Invalid coordinate format received from cliclick: "${output}"`);
}

/**
 * Performs a mouse click at the current cursor position using cliclick.
 * Throws a CliclickError if the click fails.
 */
async function click(): Promise<void> {
  await runCliclick(["c:."]); // Throws CliclickError on failure
}

/**
 * Handles a single tick of the auto-clicker interval.
 * Gets current coordinates, checks for movement, and performs a click.
 * @param previousCoords The coordinates from the previous tick.
 * @returns The current coordinates if the click was successful and within tolerance, otherwise null to signal stopping.
 */
async function handleIntervalTick(previousCoords: Point): Promise<Point | null> {
    const currentCoords = await getCurrentCoords(); // Can throw CliclickError

    const dx = Math.abs(currentCoords.x - previousCoords.x);
    const dy = Math.abs(currentCoords.y - previousCoords.y);

    // Check if movement exceeds tolerance
    if (dx > TOLERANCE || dy > TOLERANCE) {
        console.log("\nMouse moved significantly.");
        console.log(`  Previous coordinates: (${previousCoords.x}, ${previousCoords.y})`);
        console.log(`  Current coordinates: (${currentCoords.x}, ${currentCoords.y})`);
        console.log("Stopping auto clicker.");
        return null; // Signal to stop
    }

    // Click if movement is within tolerance
    console.log(`Clicking at (${currentCoords.x}, ${currentCoords.y})...`);
    await click(); // Can throw CliclickError

    return currentCoords; // Return current coords for the next iteration
}


// --- Main Logic ---
async function main() {
  console.log(
    `Auto Clicker started (stops if mouse moves more than ${TOLERANCE} pixels).`,
  );
  console.log(`Click interval: ${INTERVAL_MS} ms`);
  console.log("Press Ctrl + C to stop manually.");
  console.log("--------------------------------------------------");

  let intervalId: number | undefined = undefined;
  let previousCoords: Point | null = null; // Initialize as null

  // Gracefully handle Ctrl+C (SIGINT)
  const stopInterval = () => {
      if (intervalId !== undefined) {
          clearInterval(intervalId);
          intervalId = undefined; // Mark as cleared
          console.log("\nAuto clicker stopped.");
      }
  };

  Deno.addSignalListener("SIGINT", () => {
    console.log("\nCtrl+C detected. Stopping...");
    stopInterval();
    Deno.exit(0); // Exit cleanly after stopping
  });

  try {
    // Get initial coordinates
    previousCoords = await getCurrentCoords();
    console.log(`Initial coordinates: (${previousCoords.x}, ${previousCoords.y})`);

    // Perform the first click immediately
    console.log(`Performing initial click at (${previousCoords.x}, ${previousCoords.y})...`);
    await click();

    // Start the interval timer
    intervalId = setInterval(async () => {
      // previousCoords is guaranteed to be non-null here after the initial setup
      if (!previousCoords) {
          console.error("Internal error: previousCoords is null. Stopping.");
          stopInterval();
          Deno.exit(1);
          return; // Should not be reached
      }

      try {
        const nextCoords = await handleIntervalTick(previousCoords);
        if (nextCoords === null) {
          // Mouse moved or other condition to stop
          stopInterval();
          Deno.exit(0); // Clean exit
        } else {
          previousCoords = nextCoords; // Update for the next iteration
        }
      } catch (error) {
        if (error instanceof CliclickError) {
          console.error(`Error during interval: ${error.message}. Stopping.`);
        } else {
          console.error("An unexpected error occurred during interval. Stopping:", error);
        }
        stopInterval();
        Deno.exit(1); // Exit with error code
      }
    }, INTERVAL_MS);

  } catch (error) {
    // Handle errors during initial setup (getting coords or first click)
    if (error instanceof CliclickError) {
      console.error(`Initialization failed: ${error.message}. Exiting.`);
    } else {
      console.error("An unexpected error occurred during initialization. Exiting:", error);
    }
    Deno.exit(1);
  }

  // Keep the process alive while the interval is running
  // The signal listener handles the exit.
}

// Run the main function
main(); // No top-level catch needed as main handles its errors and exits