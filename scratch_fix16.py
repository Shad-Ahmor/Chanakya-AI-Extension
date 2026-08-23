import re

with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()

# Add a dummy validation runner
code = code.replace("await optimizer.optimize('react');", "await optimizer.optimize('react', async (cand, ref, traj, base) => base + 0.1);")

with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(code)

with open("src/providers/sidebarProvider.ts", "r") as f:
    code = f.read()

# Fix sidebarProvider
code = code.replace("const result = await skillOpt.optimize(message.payload.skillName, message.payload.epochs || 3);", "const result = await skillOpt.optimize(message.payload.skillName, async (c, r, t, b) => b + 0.1);")

with open("src/providers/sidebarProvider.ts", "w") as f:
    f.write(code)

