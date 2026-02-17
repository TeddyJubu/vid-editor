export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

	const units = ["B", "KB", "MB", "GB", "TB"] as const;
	let v = bytes;
	let u = 0;
	while (v >= 1024 && u < units.length - 1) {
		v /= 1024;
		u += 1;
	}

	if (u === 0) return `${Math.floor(v)} ${units[u]}`;
	const rounded = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(1);
	return `${rounded} ${units[u]}`;
}
