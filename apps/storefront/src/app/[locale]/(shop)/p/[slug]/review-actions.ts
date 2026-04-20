'use server';

import { revalidatePath } from 'next/cache';
import { submitReview } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/session';

export type ReviewFormState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

export async function submitReviewAction(
  productId: string,
  locale: string,
  slug: string,
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const session = await getCurrentCustomer();
  if (!session) {
    return {
      status: 'error',
      message: `Sign in to leave a review.`,
    };
  }

  const ratingRaw = (formData.get('rating') ?? '').toString();
  const rating = Number.parseInt(ratingRaw, 10);
  const title = (formData.get('title') ?? '').toString().trim();
  const body = (formData.get('body') ?? '').toString().trim();
  const authorName =
    session.displayName?.trim() ?? session.email.split('@')[0]!;

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { status: 'error', message: 'Pick a 1–5 star rating.' };
  }

  try {
    const review = await submitReview({
      productId,
      rating,
      authorName,
      authUserId: session.userId,
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
    });
    if (!review) {
      return { status: 'error', message: 'Could not submit your review.' };
    }
    revalidatePath(`/${locale}/p/${slug}`);
    return {
      status: 'ok',
      message: 'Thanks! Your review is in moderation.',
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
