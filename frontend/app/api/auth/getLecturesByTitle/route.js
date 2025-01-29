import connectDB from '@/utils/db';
import User from '@/models/User';  // User model with embedded lectures
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    await connectDB();

    // Find user(s) with lectures containing the title
    const user = await User.findOne({ 'lectures.title': new RegExp(title, 'i') }, 'lectures');

    if (!user || user.lectures.length === 0) {
      return NextResponse.json({ error: 'No lectures found for the given title' }, { status: 404 });
    }

    // Filter the lectures that match the title
    const matchingLectures = user.lectures.filter(lecture =>
      new RegExp(title, 'i').test(lecture.title)
    );

    return NextResponse.json({
      message: 'Lectures retrieved successfully',
      lectures: matchingLectures,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching lectures by title:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
