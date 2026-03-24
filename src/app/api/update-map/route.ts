import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST() {
    try {
        await execPromise('npm run generate-map');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Map generation failed:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate map' },
            { status: 500 }
        );
    }
}
