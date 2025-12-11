import { storage } from "./storage";

export async function seedAdminIfEmpty(): Promise<void> {
  try {
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      console.log("[Admin Seed] No users found. Creating default admin account...");
      
      await storage.createUser({
        name: "Joshua Orlinsky",
        email: "josh@equiturn.com",
        password: "admin123!",
        role: "CEO",
        status: "active",
        score: 100,
        activeDeals: 0,
        completedTasks: 0,
      });
      
      console.log("[Admin Seed] Default admin account created successfully!");
      console.log("[Admin Seed] Email: josh@equiturn.com");
      console.log("[Admin Seed] Password: admin123!");
      console.log("[Admin Seed] IMPORTANT: Please change this password after first login!");
    } else {
      console.log(`[Admin Seed] Found ${users.length} existing users. Skipping admin seed.`);
    }
  } catch (error) {
    console.error("[Admin Seed] Error checking/creating admin:", error);
  }
}
