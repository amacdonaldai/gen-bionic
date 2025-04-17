import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * API route to proxy images from external sources to avoid CORS issues
 * Usage: /api/proxy-image?url=https://example.com/image.jpg
 */
export async function GET(request: NextRequest) {
    try {
        // Get the URL from the query parameter
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        // Check if URL is provided
        if (!imageUrl) {
            console.error('Missing image URL parameter');
            return new NextResponse('Missing image URL', { status: 400 });
        }

        // Validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(imageUrl);
        } catch (error) {
            console.error(`Invalid image URL: ${imageUrl}`, error);
            return new NextResponse('Invalid image URL', { status: 400 });
        }

        console.log(`Proxying image: ${imageUrl}`);

        // Fetch the image with proper headers
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': parsedUrl.origin
            }
        });

        // Check if the fetch was successful
        if (!response.ok) {
            console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
                status: response.status,
            });
        }

        // Get the image content type
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        console.log(`Image content type: ${contentType}`);

        // Create a new response with the image
        const imageBlob = await response.blob();
        const imageArrayBuffer = await imageBlob.arrayBuffer();

        // Return the image with appropriate headers
        return new NextResponse(imageArrayBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            },
        });
    } catch (error) {
        console.error('Error proxying image:', error);
        return new NextResponse('Error proxying image', { status: 500 });
    }
} 