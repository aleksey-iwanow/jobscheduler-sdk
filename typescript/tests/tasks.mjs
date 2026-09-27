import { writeFile } from "node:fs/promises";
import { process, task } from "../dist/index.js";

process("people", { description: "Compatibility example" });
task("normalize", { process: "people", parameters: { username: "string" } },
  ({ username }) => ({ username: username.trim().toLowerCase() }));
task("save", { process: "people", dependsOn: ["normalize"] },
  async (_, context) => {
    const username = context.result("normalize").username;
    await writeFile(context.workspacePath("username.txt"), username, "utf8");
    console.log("saved", username);
    return { username };
  });
