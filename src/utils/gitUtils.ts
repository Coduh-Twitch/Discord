import { execSync } from "child_process";

const ENDPOINT = "https://api.github.com";
const REPO = "Coduh-Twitch/Discord"

export default class GitUtils {
    private static createHeaders(): Headers {
        const headers = new Headers();

        headers.append("Authorization", `Bearer ${process.env.GH_TOKEN}`)

        return headers;
    }
    
    static async getCommitHash(): Promise<string | null> {
        try {

            const res = await execSync('git rev-parse HEAD');
            let hash = res.toString();
            hash = hash.slice(0, 7)
            
            return hash;
        } catch(e) {
            return null;
        }
    }
}