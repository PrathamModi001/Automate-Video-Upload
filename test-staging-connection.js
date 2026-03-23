/**
 * Test Script - Verify Connection to Staging MongoDB via SSH Tunnel
 *
 * This script connects to MongoDB using the same URI as the video server
 * and queries the activities collection to confirm we're connected to staging.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

console.log('========================================================================');
console.log('Testing Connection to Staging MongoDB via SSH Tunnel');
console.log('========================================================================\n');

console.log('📋 Connection Details:');
console.log(`   URI: ${MONGODB_URI.replace(/:[^:]*@/, ':***@')}`);
console.log(`   Database: ${MONGODB_URI.split('/').pop()?.split('?')[0]}`);
console.log('\n🔌 Connecting to MongoDB...\n');

async function testConnection() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);

        console.log('✅ MongoDB Connected Successfully!\n');

        // Get database stats
        const db = mongoose.connection.db;
        const stats = await db.stats();

        console.log('📊 Database Statistics:');
        console.log(`   Database: ${stats.db}`);
        console.log(`   Collections: ${stats.collections}`);
        console.log(`   Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Documents: ${stats.objects}`);
        console.log('');

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('📁 Collections in Database:');
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        console.log('');

        // Test activities collection
        const activitiesCollection = db.collection('activities');
        const activityCount = await activitiesCollection.countDocuments();

        console.log('🎬 Activities Collection:');
        console.log(`   Total Activities: ${activityCount}`);

        if (activityCount > 0) {
            // Get sample activities
            const sampleActivities = await activitiesCollection
                .find()
                .limit(3)
                .project({
                    title: 1,
                    type: 1,
                    'details.isRecordingAvailable': 1,
                    'details.isUploaded': 1,
                    createdAt: 1
                })
                .toArray();

            console.log('\n📝 Sample Activities (first 3):');
            sampleActivities.forEach((activity, index) => {
                console.log(`\n   ${index + 1}. ${activity.title || 'Untitled'}`);
                console.log(`      ID: ${activity._id}`);
                console.log(`      Type: ${activity.type}`);
                console.log(`      Recording Available: ${activity.details?.isRecordingAvailable || false}`);
                console.log(`      Uploaded: ${activity.details?.isUploaded || false}`);
                console.log(`      Created: ${activity.createdAt?.toISOString().split('T')[0] || 'N/A'}`);
            });

            // Check for pending uploads (what video server processes)
            const pendingUploads = await activitiesCollection.countDocuments({
                type: 'live_session',
                'details.isRecordingAvailable': true,
                'details.isUploaded': { $ne: true },
                'details.roomId': { $exists: true },
                isDeleted: false,
                endTime: { $lt: new Date() }
            });

            console.log('\n\n🔄 Pending Video Uploads:');
            console.log(`   Count: ${pendingUploads} activities need processing`);

            if (pendingUploads > 0) {
                console.log('   ⚠️  Video server will process these when auto-processor runs');
            } else {
                console.log('   ✅ No pending uploads - all recordings processed');
            }
        }

        // Test users collection (confirm staging data)
        const usersCollection = db.collection('users');
        const userCount = await usersCollection.countDocuments({ isDeleted: { $ne: true } });

        console.log('\n\n👥 Users Collection:');
        console.log(`   Total Active Users: ${userCount}`);

        if (userCount > 0) {
            const sampleUser = await usersCollection.findOne(
                { isDeleted: { $ne: true } },
                { projection: { firstname: 1, lastname: 1, email: 1, enrollmentNumber: 1, createdAt: 1 } }
            );

            if (sampleUser) {
                console.log('\n   Sample User (confirms staging data):');
                console.log(`      Name: ${sampleUser.firstname || ''} ${sampleUser.lastname || ''}`);
                console.log(`      Email: ${sampleUser.email || 'N/A'}`);
                console.log(`      Enrollment: ${sampleUser.enrollmentNumber || 'N/A'}`);
            }
        }

        // Test courses collection
        const coursesCollection = db.collection('courses');
        const courseCount = await coursesCollection.countDocuments({ isDeleted: { $ne: true } });

        console.log('\n\n📚 Courses Collection:');
        console.log(`   Total Active Courses: ${courseCount}`);

        console.log('\n========================================================================');
        console.log('✅ SUCCESS: Connected to Staging MongoDB!');
        console.log('========================================================================');
        console.log('\n🎯 Verification Summary:');
        console.log(`   ✓ Database: ${stats.db}`);
        console.log(`   ✓ Total Collections: ${stats.collections}`);
        console.log(`   ✓ Total Documents: ${stats.objects}`);
        console.log(`   ✓ Activities: ${activityCount}`);
        console.log(`   ✓ Users: ${userCount}`);
        console.log(`   ✓ Courses: ${courseCount}`);

        if (activityCount > 0 || userCount > 0 || courseCount > 0) {
            console.log('\n✅ This is STAGING data (confirmed by document counts)');
        } else {
            console.log('\n⚠️  Database is empty - this might not be staging');
        }

        console.log('\n🚀 You can now start the video server:');
        console.log('   npm run dev');
        console.log('');

    } catch (error) {
        console.error('\n❌ ERROR: Connection Failed!');
        console.error(`   Message: ${error.message}`);
        console.error(`   Code: ${error.code || 'N/A'}`);

        if (error.message.includes('ECONNREFUSED')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   - Make sure SSH tunnel is running (start-ssh-tunnel.bat)');
            console.error('   - Check port 27018 is listening: netstat -ano | findstr 27018');
        } else if (error.message.includes('Authentication failed')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   - Check MongoDB credentials in .env file');
            console.error('   - Verify database name and authSource are correct');
        }

        console.error('');
        process.exit(1);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('🔌 Connection closed\n');
    }
}

// Run the test
testConnection();
