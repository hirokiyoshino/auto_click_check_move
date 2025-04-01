/// <reference types="https://deno.land/x/deno/runtime/types.d.ts" />
// Note: If you still see errors related to the 'Deno' namespace,
// please ensure the VS Code Deno extension is enabled and configured correctly for this workspace.
// You might need to run "Deno: Initialize Workspace Configuration" from the command palette.

// --- Settings ---
const INTERVAL_MS = 100; // Click interval in milliseconds (0.1 seconds) - Increased for visibility/reliability
const TOLERANCE = 10; // Allowed mouse movement tolerance in pixels
// --- End Settings ---

interface Point {
  x: number;
  y: number;
}

/**
 * Runs the cliclick command with the given arguments.
 * Throws an error if the command fails or is not found.
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
      const errorOutput = new TextDecoder().decode(stderr);
      // Provide specific error for common permission issue
      if (errorOutput.includes("permission")) {
         console.error("Error: cliclick permission denied. Check System Settings > Privacy & Security > Accessibility.");
      }
      throw new Error(
        `cliclick command failed with code ${code}: ${errorOutput.trim()}`,
      );
    }
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    // Handle case where cliclick is not installed/found
    if (error instanceof Deno.errors.NotFound) {
      console.error(
        "Error: 'cliclick' command not found. Please install it (e.g., `brew install cliclick`) and ensure it's in your PATH.",
      );
       Deno.exit(1); // Exit if dependency is missing
     }
     // Log other errors before re-throwing or exiting
     if (error instanceof Error) {
       console.error(`An unexpected error occurred while running cliclick: ${error.message}`);
     } else {
       console.error(`An unexpected non-error value was thrown: ${error}`);
     }
    throw error; // Re-throw other errors to potentially be caught higher up or stop execution
  }
}

/**
 * Gets the current mouse coordinates using cliclick.
 * @returns A Point object with x, y coordinates, or null if an error occurs.
 */
async function getCurrentCoords(): Promise<Point | null> {
  try {
    // Add a space after p:. just in case, though likely not needed
    const output = await runCliclick(["p:."]); // "p:." returns "x,y"
    const parts = output.split(",");
    if (parts.length === 2) {
      const x = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      // Check if parsing resulted in valid numbers
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }
    // Log error if format is unexpected
    console.error(`Error: Invalid coordinate format received from cliclick: "${output}"`);
    return null;
  } catch (error) {
    // Error is already logged in runCliclick, just return null
    // console.error(`Error getting coordinates: ${error.message}`);
    return null;
  }
}

/**
 * Performs a mouse click at the current cursor position using cliclick.
 * @returns True if the click was successful, false otherwise.
 */
async function click(): Promise<boolean> {
  try {
    // Add a space after c:. just in case
    await runCliclick(["c:."]);
    return true;
  } catch (error) {
    // Error is already logged in runCliclick
    // console.error(`Error performing click: ${error.message}`);
    return false;
  }
}

// --- Main Logic ---
async function main() {
    console.log(
    `Auto Clicker started (stops if mouse moves more than ${TOLERANCE} pixels).`,
    );
    console.log(`Click interval: ${INTERVAL_MS} ms`);
    console.log("Press Ctrl + C to stop manually.");
    console.log("--------------------------------------------------");

    // Attempt to get initial coordinates
    let previousCoords: Point | null = await getCurrentCoords();

    if (previousCoords === null) { // Explicit null check
        console.error("Error: Could not get initial coordinates. Exiting.");
        Deno.exit(1); // Exit if initial state cannot be determined
    }
    // Type assertion is safe here due to the check above
    // Type assertion is safe here due to the check above
    console.log(`Initial click coordinates: (${previousCoords!.x}, ${previousCoords!.y})`);

    // Perform the first click immediately
    if (!await click()) {
        console.error("Error: Failed to perform initial click. Exiting.");
        Deno.exit(1);
    }

    // Start the interval timer
    const intervalId = setInterval(async () => {
    const currentCoords: Point | null = await getCurrentCoords();

    // If getting coordinates fails, stop the process
    if (currentCoords === null) { // Explicit null check
        console.error("Error: Failed to get current coordinates. Stopping.");
        clearInterval(intervalId);
        Deno.exit(1); // Exit if coordinates cannot be obtained
    }

    // Check for movement. Both currentCoords and previousCoords must be non-null.
    // previousCoords is guaranteed non-null after the first successful iteration.
    // currentCoords is checked above.
    if (previousCoords && currentCoords) { // Ensure both are valid Points
        const dx = Math.abs(currentCoords.x - previousCoords.x);
        const dy = Math.abs(currentCoords.y - previousCoords.y);

        // Check if movement exceeds tolerance
        if (dx > TOLERANCE || dy > TOLERANCE) {
            console.log("\nMouse moved significantly.");
            // Both are confirmed non-null here
            console.log(`  Previous coordinates: (${previousCoords.x}, ${previousCoords.y})`);
            console.log(`  Current coordinates: (${currentCoords.x}, ${currentCoords.y})`);
            console.log("Stopping auto clicker.");
            clearInterval(intervalId);
            Deno.exit(0); // Exit cleanly after stopping due to movement
        }
    } else if (!currentCoords) {
        // This case should already be handled by the exit above, but adding for robustness
        console.error("Error: Current coordinates became null unexpectedly. Stopping.");
        clearInterval(intervalId);
        Deno.exit(1);
    }

    // Click if movement is within tolerance
    console.log(`Clicking at (${currentCoords.x}, ${currentCoords.y})...`); // Added log
    if (!await click()) {
        // If click fails, stop the process
        console.error("Error: Failed to perform click. Stopping.");
        clearInterval(intervalId);
        Deno.exit(1); // Exit if click fails
    }

    // Update previous coordinates for the next iteration, only if currentCoords is valid
    if (currentCoords) {
        previousCoords = currentCoords;
    }
    // If currentCoords was null, the loop would have exited already.

    }, INTERVAL_MS);

    // Gracefully handle Ctrl+C (SIGINT)
    Deno.addSignalListener("SIGINT", () => {
    console.log("\nCtrl+C detected. Stopping auto clicker.");
    clearInterval(intervalId);
    // Allow the event loop to clear before exiting, or exit directly
    Deno.exit(0);
    });
}

// Run the main function
main().catch(error => {
    console.error("An unexpected error occurred in the main execution:", error);
    Deno.exit(1);
});