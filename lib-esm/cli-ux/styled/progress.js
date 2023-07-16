// 3pp
import { SingleBar } from 'cli-progress';
export default function progress(options = {}) {
    return new SingleBar({ noTTYOutput: Boolean(process.env.TERM === 'dumb' || !process.stdin.isTTY), ...options });
}
