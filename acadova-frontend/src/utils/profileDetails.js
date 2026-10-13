export const YEAR_LEVELS = ['', '1st year', '2nd year', '3rd year', '4th year', '5th year', '6th year', 'Other'];
export const LANGUAGES = ['English', 'Filipino', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Waray', 'Spanish', 'Japanese', 'Korean', 'Mandarin Chinese', 'French', 'German', 'Arabic', 'Malay', 'Indonesian', 'Thai', 'Vietnamese', 'Hindi', 'Portuguese', 'Filipino Sign Language'];
export function profileDetailsDraft(user) {
  return { bio: user?.bio || '', university: user?.university || '', yearLevel: user?.yearLevel || '', languages: user?.languages || [],
    profileVisibility: Object.fromEntries(['bio', 'university', 'yearLevel', 'languages'].map(key => [key, user?.profileVisibility?.[key] === true])) };
}
