'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureReleaseProperties, configureReleaseGradle } = require('../plugins/withAndroidReleaseOptimization.js');

// Template-fixture checks only. A passing fixture test is NOT an Android release smoke test.
test('enables shrinking and obfuscation without deleting unrelated Gradle properties', () => {
  const existing = [
    { type: 'comment', value: 'Existing settings' },
    { type: 'property', key: 'hermesEnabled', value: 'true' },
    { type: 'property', key: 'android.enableProguardInReleaseBuilds', value: 'false' },
    { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'false' },
  ];
  const configured = configureReleaseProperties(existing);
  assert.equal(configured.find((entry) => entry.key === 'hermesEnabled').value, 'true');
  for (const key of ['android.enableProguardInReleaseBuilds', 'android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds']) {
    assert.equal(configured.filter((entry) => entry.key === key).length, 1);
    assert.equal(configured.find((entry) => entry.key === key).value, 'true');
  }
  assert.deepEqual(configureReleaseProperties(configured), configured);
  assert.equal(existing[2].value, 'false');
});

test('requests cloud-build diagnostics without disabling R8 or overwriting JVM settings', () => {
  const existing = [
    { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
    { type: 'property', key: 'org.gradle.logging.stacktrace', value: 'internal' },
    { type: 'property', key: 'org.gradle.logging.stacktrace', value: 'full' },
    { type: 'property', key: 'org.gradle.warning.mode', value: 'summary' },
  ];
  const configured = configureReleaseProperties(existing);
  for (const key of ['org.gradle.logging.stacktrace', 'org.gradle.warning.mode']) {
    assert.equal(configured.filter((entry) => entry.key === key).length, 1);
    assert.equal(configured.find((entry) => entry.key === key).value, 'all');
  }
  assert.equal(configured.find((entry) => entry.key === 'org.gradle.jvmargs').value, existing[0].value);
  assert.equal(configured.find((entry) => entry.key === 'android.enableProguardInReleaseBuilds').value, 'true');
  assert.equal(configured.find((entry) => entry.key === 'android.enableMinifyInReleaseBuilds').value, 'true');
  assert.deepEqual(configureReleaseProperties(configured), configured);
  assert.equal(existing[1].value, 'internal');
  assert.equal(configured.some((entry) => entry.key === 'org.gradle.logging.level'), false);
});

test('keeps application rules and selects the optimized defaults idempotently', () => {
  const original = `android {
  buildTypes {
    release {
      minifyEnabled enableProguardInReleaseBuilds
      shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
      proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
  }
}`;
  const configured = configureReleaseGradle(original);
  assert.match(configured, /proguard-android-optimize\.txt/);
  assert.match(configured, /"proguard-rules\.pro", "rds-release\.pro"/);
  assert.match(configured, /minifyEnabled enableProguardInReleaseBuilds/);
  assert.equal(configureReleaseGradle(configured), configured);
});

test('supports single-quoted Expo declarations', () => {
  const configured = configureReleaseGradle("  proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'\n");
  assert.match(configured, /proguard-android-optimize\.txt/);
  assert.match(configured, /rds-release\.pro/);
});

test('reports incompatible native templates instead of silently disabling optimization', () => {
  assert.throws(() => configureReleaseGradle('android {}'), /standard Expo Android/);
  assert.throws(() => configureReleaseGradle('getDefaultProguardFile("proguard-android-optimize.txt")'), /proguardFiles/);
});
