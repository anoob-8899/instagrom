export {};

async function seedClassroom() {
  const BASE_URL = "http://localhost:3000";

  const students = [
    { username: "alice", displayName: "Alice Cooper", password: "123456" },
    { username: "bob", displayName: "Bob Builder", password: "123456" },
    { username: "charlie", displayName: "Charlie Brown", password: "123456" },
  ];

  console.log("=== SEEDING CLASSROOM ACCOUNTS (ALICE, BOB, CHARLIE) ===");

  for (const student of students) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: student.username,
        displayName: student.displayName,
        password: student.password,
        confirmPassword: student.password,
      }),
    });

    if (res.status === 201) {
      console.log(`✔ Registered ${student.username} (${student.displayName})`);
    } else if (res.status === 409) {
      console.log(`ℹ ${student.username} already exists in database`);
    } else {
      const err = await res.json();
      console.error(`✖ Failed to register ${student.username}:`, err);
    }
  }

  console.log("Seeding complete.");
}

seedClassroom().catch(console.error);
